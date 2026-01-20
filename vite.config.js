import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(),
    ({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectRegister: "auto",

      // ✅ ESTO es lo importante: fuerza a usar TU SW real
      injectManifest: {
        swSrc: "src/sw.js",
      },

      includeAssets: ["logo.png"],

      // 👇 IMPORTANTE: esto es lo de injectManifest (NO workbox)
      injectManifest: {
        // si no pones nada, suele funcionar igual,
        // pero esto ayuda a que no “caiga” a generateSW
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },

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
    }),
  ],
});

  
 
 
