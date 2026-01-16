import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png"],
      manifest: {
        name: "Global Padel",
        short_name: "GlobalPadel",
        description: "Encuentra clubs, crea partidos y chatea",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/logo.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      // ✅ MUY IMPORTANTE: para que el build se comporte como SPA
      // y el service worker no te deje pantallazos blancos por rutas.
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
      },
    }),
  ],

  // ✅ Esto hace que Vite trate el proyecto como SPA (React Router)
  appType: "spa",

  // ✅ Para que desde el móvil funcione bien el preview por IP
  preview: {
    host: true,        // escucha en 0.0.0.0
    port: 4173,
    strictPort: true,
  },

  // (Opcional pero útil) Para el dev server por IP también
  server: {
    host: true,
  },
});
