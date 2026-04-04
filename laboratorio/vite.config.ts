import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

function normalizeBasePath(pathname?: string) {
  const rawPath = pathname?.trim();
  if (!rawPath || rawPath === "/") return "/";

  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const labBasePath = normalizeBasePath(env.VITE_LAB_BASE_PATH);

  return {
    base: labBasePath === "/" ? "/" : `${labBasePath}/`,
    publicDir: path.resolve(__dirname, "../frontend/public"),
    server: {
      host: "0.0.0.0",
      port: 8081,
      allowedHosts: true,
      fs: {
        allow: [path.resolve(__dirname, "..")],
      },
      proxy: {
        "/api": {
          target: "http://localhost:3333",
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
        },
      },
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.jpeg", "robots.txt", "logouorlabratoriowite.png"],
        manifest: {
          name: "UOR Connect Laboratorio",
          short_name: "Laboratorio",
          description: "Arena técnica do Laboratório UOR Connect",
          start_url: labBasePath === "/" ? "/" : labBasePath,
          scope: labBasePath === "/" ? "/" : `${labBasePath}/`,
          display: "standalone",
          orientation: "portrait-primary",
          background_color: "#071117",
          theme_color: "#00e5c8",
          lang: "pt-BR",
          categories: ["education", "productivity"],
          prefer_related_applications: false,
          icons: [
            { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ],
          shortcuts: [
            {
              name: "Arena",
              short_name: "Arena",
              description: "Abrir ambiente competitivo",
              url: `${labBasePath === "/" ? "" : labBasePath}/arena`,
              icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }]
            },
            {
              name: "Ranking",
              short_name: "Ranking",
              description: "Ver classificação do concurso",
              url: `${labBasePath === "/" ? "" : labBasePath}/ranking`,
              icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }]
            }
          ]
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*\bGET/,
              handler: "NetworkFirst",
              options: {
                cacheName: "laboratorio-api-get-cache",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 3 },
                networkTimeoutSeconds: 5,
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "laboratorio-assets",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 }
              }
            }
          ],
          skipWaiting: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
      }),
    ],
    define: {
      "import.meta.env.VITE_APP_RUNTIME": JSON.stringify("laboratorio"),
      "import.meta.env.VITE_LAB_BASE_PATH": JSON.stringify(labBasePath),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "../frontend/src"),
        "@app": path.resolve(__dirname, "./src"),
      },
    },
  };
});
