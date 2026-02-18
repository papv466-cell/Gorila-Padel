// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import { ToastProvider } from "./components/ToastProvider";
import { CartProvider } from './contexts/CartContext';

// ✅ Service Worker en PROD y también en DEV (localhost)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("✅ SW registrado:", reg.scope);
      await navigator.serviceWorker.ready;
      console.log("✅ SW ready");
    } catch (e) {
      console.warn("❌ SW register error:", e);
    }
  });
}

// ✅ Render ÚNICO de React
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>        {/* ← Router PRIMERO */}
      <ToastProvider>      {/* ← Toast dentro del Router */}
        <CartProvider>     {/* ← Cart dentro del Router */}
          <App />
        </CartProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// ✅ Mata el boot splash SIEMPRE (por si hay carreras)
function killBootSplash() {
  const boot = document.getElementById("boot-splash");
  if (boot) boot.remove();
}
killBootSplash();
setTimeout(killBootSplash, 50);
setTimeout(killBootSplash, 250);