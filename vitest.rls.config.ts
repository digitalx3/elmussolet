import { defineConfig } from "vitest/config";
import path from "path";

// Dedicated config for the RLS suite. Runs in a Node environment (no jsdom)
// and only matches the integration tests under src/test/rls.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/rls/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 90_000,
    fileParallel: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
