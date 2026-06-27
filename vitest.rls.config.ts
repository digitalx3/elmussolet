import { defineConfig } from "vitest/config";
import path from "path";
import { loadRlsEnv } from "./src/test/rls/env";

// Single source of truth for env loading — see src/test/rls/env.ts.
// Precedence: real process.env (CI/shell) → .env.local → .env.test → .env.
loadRlsEnv();

// Dedicated config for the RLS suite. Runs in a Node environment (no jsdom)
// and only matches the integration tests under src/test/rls.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/rls/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 90_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
