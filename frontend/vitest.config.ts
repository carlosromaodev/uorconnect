import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 60000,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/pages/Submeter.tsx", "src/pages/submission-form.validation.ts"],
      thresholds: {
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0,
        "src/pages/submission-form.validation.ts": {
          branches: 90,
          functions: 100,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
