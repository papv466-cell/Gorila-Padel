import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

import "leaflet/dist/leaflet.css";
import "./styles/leaflet.css";
import "./styles/app.css";
import "./index.css";

import AppErrorBoundary from "./components/UI/AppErrorBoundary.jsx";
import { registerSW } from "virtual:pwa-register";
import { supabase } from "./services/supabaseClient";

// ✅ Esto permite que el Service Worker pida el token a la pestaña
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", async (event) => {
    if (event.data?.type === "GP_GET_TOKEN") {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || null;

      // Responder por el canal (MessageChannel)
      event.ports?.[0]?.postMessage({ token });
    }
  });
}

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("Nueva versión disponible");
  },
  onOfflineReady() {
    console.log("Lista para offline");
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
