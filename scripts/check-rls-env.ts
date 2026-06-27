import { getRlsEnv } from "../src/test/rls/env.js";

// Fast pre-flight check for the RLS test suite.
// Runs before Vitest to fail early with a clear message when required
// Supabase credentials are missing, instead of timing out on network errors.

try {
  getRlsEnv();
  console.log("[check-rls-env] Required Supabase env vars present.");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}
