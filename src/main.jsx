// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { SessionProvider } from './contexts/SessionContext.jsx'
import { CartProvider } from './contexts/CartContext.jsx'
import { FeaturesProvider } from './contexts/FeaturesContext.jsx'
import { SportProvider } from './contexts/SportContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <SessionProvider>
      <CartProvider>
        <FeaturesProvider>
          <SportProvider>
            <App />
          </SportProvider>
        </FeaturesProvider>
      </CartProvider>
    </SessionProvider>
  </BrowserRouter>,
)

// Registrar Service Worker para cachear assets
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}