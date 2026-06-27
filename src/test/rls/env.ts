/* eslint-disable no-console */
// Centralised env loading for the RLS suite. Reads, in this precedence
// (highest wins): real process.env (CI) → .env.local → .env.test → .env.
// This keeps CI and local runs consistent: CI injects via GitHub Actions
// `env:` block, local devs use a .env.local override on top of the
// project-wide .env that ships VITE_SUPABASE_*.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILES = [".env", ".env.test", ".env.local"]; // applied left → right

function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let loaded = false;
const filledByDotenv = new Set<string>();

export function loadRlsEnv(): void {
  if (loaded) return;
  for (const file of FILES) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    const parsed = parseDotenv(fs.readFileSync(p, "utf8"));
    for (const [k, v] of Object.entries(parsed)) {
      // Real process.env (CI / shell) always wins over dotenv files.
      // Later dotenv files override earlier ones.
      if (process.env[k] !== undefined && !filledByDotenv.has(k)) continue;
      process.env[k] = v;
      filledByDotenv.add(k);
    }
  }
  loaded = true;
}


export interface RlsEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  adminEmail: string;
  adminPassword: string;
}

export function getRlsEnv(): RlsEnv {
  loadRlsEnv();
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!adminEmail) missing.push("TEST_ADMIN_EMAIL");
  if (!adminPassword) missing.push("TEST_ADMIN_PASSWORD");
  if (missing.length) {
    throw new Error(
      `[rls-tests] Missing required env vars: ${missing.join(", ")}. ` +
        `Set them in .env / .env.local (local) or as GitHub Actions secrets (CI).`,
    );
  }
  return { supabaseUrl: supabaseUrl!, supabaseAnonKey: supabaseAnonKey!, adminEmail: adminEmail!, adminPassword: adminPassword! };
}
