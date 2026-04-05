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
  const labBaseHref = labBasePath === "/" ? "/" : `${labBasePath}/`;
  const iconPath = (size: 192 | 512) =>
    `${labBasePath === "/" ? "" : labBasePath}/icons/icon-${size}x${size}.png`;

  return {
    base: labBaseHref,
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
          start_url: labBaseHref,
          scope: labBaseHref,
          display: "standalone",
          orientation: "portrait-primary",
          background_color: "#071117",
          theme_color: "#00e5c8",
          lang: "pt-BR",
          categories: ["education", "productivity"],
          prefer_related_applications: false,
          icons: [
            { src: iconPath(192), sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: iconPath(512), sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ],
          shortcuts: [
            {
              name: "Arena",
              short_name: "Arena",
              description: "Abrir ambiente competitivo",
              url: `${labBaseHref}arena`,
              icons: [{ src: iconPath(192), sizes: "192x192" }]
            },
            {
              name: "Ranking",
              short_name: "Ranking",
              description: "Ver classificação do concurso",
              url: `${labBaseHref}ranking`,
              icons: [{ src: iconPath(192), sizes: "192x192" }]
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
      dedupe: ["react", "react-dom", "react-router-dom"],
      alias: {
        react: path.resolve(__dirname, "./node_modules/react"),
        "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime.js"),
        "@": path.resolve(__dirname, "../frontend/src"),
        "@app": path.resolve(__dirname, "./src"),
        assert: path.resolve(__dirname, "./src/shims/assert.ts"),
        util: path.resolve(__dirname, "./src/shims/util.ts"),
      },
    },
  };
});
