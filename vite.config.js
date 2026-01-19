import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",

      // ✅ ESTA es la forma correcta de decirle qué SW fuente usar
      injectManifest: {
        swSrc: "src/sw.js",
        swDest: "sw.js",
      },

      includeAssets: ["logo.png"],
      manifest: {
        name: "Gorila Padel",
        short_name: "GorilaPadel",
        description: "Encuentra clubs, crea partidos y chatea",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/logo.png", sizes: "192x192", type: "image/png" },
          { src: "/logo.png", sizes: "512x512", type: "image/png" },
        ],
      },

      // (opcional, pero no molesta)
      devOptions: {
        enabled: true,
      },
    }),
  ],
});

