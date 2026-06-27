import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // RLS integration suite hits the live backend and is opt-in via `bun run test:rls`.
    exclude: ["node_modules/**", "src/test/rls/**"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
