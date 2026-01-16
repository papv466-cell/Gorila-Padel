import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "leaflet/dist/leaflet.css";
import AppErrorBoundary from "./components/UI/AppErrorBoundary.jsx";

import "./styles/leaflet.css";
import "./styles/app.css";
import "./index.css";

import { registerSW } from "virtual:pwa-register";

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
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

