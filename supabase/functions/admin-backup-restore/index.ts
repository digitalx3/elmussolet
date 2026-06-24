import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import {
  BACKUP_GROUPS,
  BackupGroupId,
} from "../_shared/backup-groups.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface RestoreRequest {
  backup_id: string;
  groups: Array<{ id: BackupGroupId; mode: "upsert" | "wipe" }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "missing_auth" });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "invalid_token" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: isAdminRow } = await admin.rpc("is_admin", { _user_id: userData.user.id });
  if (!isAdminRow) return json(403, { error: "forbidden" });

  let body: RestoreRequest;
  try {
    body = (await req.json()) as RestoreRequest;
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!body?.backup_id || !Array.isArray(body.groups) || body.groups.length === 0) {
    return json(400, { error: "invalid_payload" });
  }
  for (const g of body.groups) {
    if (!BACKUP_GROUPS.find(bg => bg.id === g.id)) {
      return json(400, { error: "unknown_group", group: g.id });
    }
    if (g.mode !== "upsert" && g.mode !== "wipe") {
      return json(400, { error: "invalid_mode", mode: g.mode });
    }
  }

  // Load backup file
  const { data: run, error: runErr } = await admin
    .from("backup_runs")
    .select("id, file_path, status")
    .eq("id", body.backup_id)
    .single();
  if (runErr || !run?.file_path) {
    return json(404, { error: "backup_not_found" });
  }
  if (run.status !== "success") {
    return json(400, { error: "backup_not_ready" });
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from("backups")
    .download(run.file_path);
  if (dlErr || !blob) {
    return json(500, { error: "download_failed", detail: dlErr?.message });
  }

  const buf = new Uint8Array(await blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);

  // Validate manifest
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) return json(400, { error: "manifest_missing" });
  const manifest = JSON.parse(await manifestFile.async("string"));

  const report: Record<string, unknown> = {
    backup_id: body.backup_id,
    schema_version: manifest.schema_version,
    groups: [],
  };

  try {
    for (const g of body.groups) {
      const groupDef = BACKUP_GROUPS.find(bg => bg.id === g.id)!;
      const groupReport: Record<string, unknown> = { id: g.id, mode: g.mode, tables: {}, buckets: {} };

      // WIPE: delete in reverse table order
      if (g.mode === "wipe") {
        for (const tbl of [...groupDef.tables].reverse()) {
          const { error: delErr, count } = await admin
            .from(tbl)
            .delete({ count: "exact" })
            .not("id", "is", null);
          if (delErr) throw new Error(`wipe ${tbl}: ${delErr.message}`);
          (groupReport.tables as any)[tbl] = { deleted: count ?? 0 };
        }
      }

      // IMPORT tables in declared order (upsert by id)
      for (const tbl of groupDef.tables) {
        const file = zip.file(`data/${tbl}.json`);
        if (!file) {
          (groupReport.tables as any)[tbl] = {
            ...(groupReport.tables as any)[tbl],
            inserted: 0,
            note: "missing_in_backup",
          };
          continue;
        }
        const rows = JSON.parse(await file.async("string")) as unknown[];
        if (rows.length === 0) {
          (groupReport.tables as any)[tbl] = {
            ...(groupReport.tables as any)[tbl],
            inserted: 0,
          };
          continue;
        }
        // Batch in chunks of 500
        let written = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error: upErr } = await admin
            .from(tbl)
            .upsert(chunk as any, { onConflict: "id" });
          if (upErr) throw new Error(`upsert ${tbl}: ${upErr.message}`);
          written += chunk.length;
        }
        (groupReport.tables as any)[tbl] = {
          ...(groupReport.tables as any)[tbl],
          inserted: written,
        };
      }

      // Storage restore (overwrite per file)
      for (const bucket of groupDef.buckets) {
        const bucketFolder = zip.folder(`storage/${bucket}`);
        if (!bucketFolder) {
          (groupReport.buckets as any)[bucket] = { restored: 0, note: "missing_in_backup" };
          continue;
        }
        let restored = 0;
        const files: Array<{ path: string; obj: JSZip.JSZipObject }> = [];
        zip.forEach((relativePath, file) => {
          const prefix = `storage/${bucket}/`;
          if (relativePath.startsWith(prefix) && !file.dir) {
            files.push({ path: relativePath.slice(prefix.length), obj: file });
          }
        });

        if (g.mode === "wipe") {
          // List and delete all existing files first
          const existing = await listAllStorageFiles(admin, bucket);
          if (existing.length > 0) {
            await admin.storage.from(bucket).remove(existing);
          }
        }

        for (const f of files) {
          const data = await f.obj.async("uint8array");
          const { error: upErr } = await admin.storage
            .from(bucket)
            .upload(f.path, data, { upsert: true, contentType: guessContentType(f.path) });
          if (upErr) {
            (groupReport.buckets as any)[bucket] = {
              ...(groupReport.buckets as any)[bucket],
              error: upErr.message,
            };
            continue;
          }
          restored += 1;
        }
        (groupReport.buckets as any)[bucket] = {
          ...(groupReport.buckets as any)[bucket],
          restored,
        };
      }

      (report.groups as any[]).push(groupReport);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: "restore_failed", detail: message, partial_report: report });
  }

  return json(200, { ok: true, report });
});

async function listAllStorageFiles(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix = ""
): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return out;
  for (const entry of data) {
    if (entry.name === ".emptyFolderPlaceholder") continue;
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      out.push(fullPath);
    } else {
      const nested = await listAllStorageFiles(admin, bucket, fullPath);
      out.push(...nested);
    }
  }
  return out;
}

function guessContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    gif: "image/gif",
    pdf: "application/pdf",
    ttf: "font/ttf",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  return map[ext] ?? "application/octet-stream";
}
