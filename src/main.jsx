import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import "leaflet/dist/leaflet.css";
import "./index.css";


// ✅ En local, el SW suele dar guerra. Solo en PROD.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}

const container = document.getElementById("root");

// ✅ Oculta el boot splash en cuanto arranca JS (sin manipular el DOM más)
const boot = document.getElementById("boot-splash");
if (boot) boot.style.display = "none";

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
#root {
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: initial !important;
}