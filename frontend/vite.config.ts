import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";


const apiProxy = {
  "/api": {
    target: "http://localhost:3333",
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/api/, ""),
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts")) return "charts";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@zxing")) return "qr-scanner";
          if (id.includes("qrcode")) return "qr-code";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("react-router")) return "router";
          if (id.includes("lucide-react") || id.includes("@phosphor-icons")) return "icons";
          return "vendor";
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: true,
    proxy: apiProxy,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "0.0.0.0",
    proxy: apiProxy,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),

  ].filter(Boolean),
  optimizeDeps: {
    include: ["zod"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
