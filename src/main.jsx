import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

import "leaflet/dist/leaflet.css";
import "./styles/leaflet.css";
import "./styles/app.css";
import "./index.css";

import AppErrorBoundary from "./components/UI/AppErrorBoundary.jsx";

// ✅ Registro manual del Service Worker (SIN virtual:pwa-register)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("✅ SW registrado:", reg.scope);
    } catch (e) {
      console.warn("❌ No se pudo registrar SW:", e);
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
