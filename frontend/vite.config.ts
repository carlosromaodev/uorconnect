import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.jpeg", "robots.txt", "logoworconnect.png"],
      manifest: {
        name: "UOR Connect",
        short_name: "UOR Connect",
        description: "Plataforma Académica Digital",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#f97316",
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*\bGET/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-get-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ],
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      }
    }),
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
