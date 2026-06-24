import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import {
  BACKUP_GROUPS,
  ALL_BACKUP_TABLES,
  ALL_BACKUP_BUCKETS,
  SCHEMA_VERSION,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "missing_auth" });

  // Verify caller is admin
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

  // Create backup_runs row
  const { data: runRow, error: runErr } = await admin
    .from("backup_runs")
    .insert({
      kind: "manual",
      status: "running",
      created_by: userData.user.id,
      created_by_email: userData.user.email ?? null,
    })
    .select("id")
    .single();
  if (runErr) return json(500, { error: "run_create_failed", detail: runErr.message });

  const runId = runRow.id as string;

  try {
    const zip = new JSZip();
    const tablesSummary: Record<string, number> = {};

    // Dump every table
    const dataDir = zip.folder("data")!;
    for (const tbl of ALL_BACKUP_TABLES) {
      // Page through in 1000-row chunks
      const rows: unknown[] = [];
      let from = 0;
      const pageSize = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await admin
          .from(tbl)
          .select("*")
          .range(from, from + pageSize - 1)
          .order("created_at", { ascending: true, nullsFirst: true } as any);
        if (error) {
          // Some tables may not have created_at — retry without order
          const retry = await admin.from(tbl).select("*").range(from, from + pageSize - 1);
          if (retry.error) throw new Error(`dump ${tbl}: ${retry.error.message}`);
          rows.push(...(retry.data ?? []));
          if (!retry.data || retry.data.length < pageSize) break;
        } else {
          rows.push(...(data ?? []));
          if (!data || data.length < pageSize) break;
        }
        from += pageSize;
      }
      dataDir.file(`${tbl}.json`, JSON.stringify(rows));
      tablesSummary[tbl] = rows.length;
    }

    // Dump storage buckets
    const storageDir = zip.folder("storage")!;
    const storageSummary: Record<string, number> = {};
    for (const bucket of ALL_BACKUP_BUCKETS) {
      const bucketDir = storageDir.folder(bucket)!;
      const listed = await listAllStorageFiles(admin, bucket);
      let count = 0;
      for (const path of listed) {
        const { data: blob, error } = await admin.storage.from(bucket).download(path);
        if (error || !blob) continue;
        const buf = new Uint8Array(await blob.arrayBuffer());
        bucketDir.file(path, buf);
        count += 1;
      }
      storageSummary[bucket] = count;
    }

    // Manifest
    const now = new Date();
    const manifest = {
      schema_version: SCHEMA_VERSION,
      created_at: now.toISOString(),
      created_by: userData.user.email ?? userData.user.id,
      groups: BACKUP_GROUPS.map(g => ({ id: g.id, label: g.label, tables: g.tables, buckets: g.buckets })),
      tables: tablesSummary,
      storage: storageSummary,
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const stamp = formatStamp(now);
    const fileName = `backup-${stamp}.zip`;
    const filePath = fileName;

    const { error: uploadErr } = await admin.storage
      .from("backups")
      .upload(filePath, zipBlob, {
        contentType: "application/zip",
        upsert: false,
      });
    if (uploadErr) throw new Error(`upload: ${uploadErr.message}`);

    await admin
      .from("backup_runs")
      .update({
        status: "success",
        file_path: filePath,
        file_size_bytes: zipBlob.byteLength,
        tables_json: tablesSummary,
        storage_json: storageSummary,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return json(200, {
      ok: true,
      run_id: runId,
      file_path: filePath,
      size_bytes: zipBlob.byteLength,
      tables: tablesSummary,
      storage: storageSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("backup_runs")
      .update({
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return json(500, { error: "backup_failed", detail: message });
  }
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
    // Files have an id; folders don't
    if (entry.id) {
      out.push(fullPath);
    } else {
      const nested = await listAllStorageFiles(admin, bucket, fullPath);
      out.push(...nested);
    }
  }
  return out;
}

function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "-" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes())
  );
}
