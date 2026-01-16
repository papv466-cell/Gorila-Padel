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

// ✅ SOLO UNA VEZ
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
