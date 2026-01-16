export function getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocalización no disponible en este navegador."));
        return;
      }
  
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => {
          // Mensajes humanos
          if (err.code === err.PERMISSION_DENIED) reject(new Error("Permiso de ubicación denegado."));
          else if (err.code === err.POSITION_UNAVAILABLE) reject(new Error("Ubicación no disponible."));
          else if (err.code === err.TIMEOUT) reject(new Error("Tiempo de espera agotado."));
          else reject(new Error("No se pudo obtener la ubicación."));
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
          ...options,
        }
      );
    });
  }
  