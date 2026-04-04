import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const apiProxy = {
  "/api": {
    target: "http://localhost:3333",
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/api/, ""),
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
        type: "module",
        suppressWarnings: true,
      },
      includeAssets: ["favicon.jpeg", "robots.txt", "logoworconnect.png"],
      manifest: {
        name: "UOR Connect",
        short_name: "UOR Connect",
        description: "Plataforma Académica Digital",
        start_url: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#f97316",
        theme_color: "#f97316",
        lang: "pt-BR",
        scope: "/",
        categories: ["education", "productivity"],
        prefer_related_applications: false,
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        shortcuts: [
          {
            name: "Cursos",
            short_name: "Cursos",
            description: "Ver cursos disponíveis",
            url: "/cursos",
            icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Projetos",
            short_name: "Projetos",
            description: "Ver projetos submetidos",
            url: "/projetos",
            icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET"
              && (url.pathname.startsWith("/api/") || url.origin === "https://api.uorconnect.space"),
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
          },
        ],
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        clientsClaim: true
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
