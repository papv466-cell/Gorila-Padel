import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "leaflet/dist/leaflet.css";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

// ✅ En local, el SW suele dar guerra. Solo en PROD.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}

// ✅ Oculta el boot splash en cuanto arranca JS
const boot = document.getElementById("boot-splash");
if (boot) boot.style.display = "none";

const container = document.getElementById("root");
if (!container) throw new Error("No se encontró #root en index.html");

// ✅ Evita createRoot duplicado por HMR / refresh
const root = window.__GP_ROOT__ ?? ReactDOM.createRoot(container);
window.__GP_ROOT__ = root;

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
