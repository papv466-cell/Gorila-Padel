import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

import "./styles/leaflet.css";
import "./styles/app.css";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ 
  onNeedRefresh() {
    // Más adelante si quieres, aquí sacamos un popup "Hay una nueva versión"
    console.log("Nueva versión disponible");
  },
  onOfflineReady() {
    console.log("Lista para offline");
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
registerSW({
  immediate: true,
});
