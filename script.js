// 1. Inicializar el mapa centrado en Sevilla
var map = L.map('map').setView([37.3891, -5.9845], 13);

// 2. Añadir la capa de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 3. Cargar los locales desde el JSON
console.log("Iniciando carga de locales...");

fetch('data/locales.json')
  .then(response => {
    // Verificar si la carga del archivo fue correcta
    if (!response.ok) {
      throw new Error(`No se pudo cargar el archivo: ${response.statusText}`);
    }
    return response.json();
  })
  .then(locales => {
    console.log(`JSON cargado. Hay ${locales.length} locales.`);

    // Crear un grupo para guardar todos los marcadores (útil para centrar el mapa)
    var grupoMarcadores = L.featureGroup();

    // Recorrer cada local y poner un pin
        locales.forEach(local => {
        if (local.lat && local.lng) {
            
            // Detectar tipo por el nombre (chapuza temporal pero efectiva)
            let nombre = (local.nombre || "").toLowerCase();
            let iconoEmoji = "📍"; // Por defecto
            
            if (nombre.includes("fruta") || nombre.includes("verdura")) {
                iconoEmoji = "🍎";
            } else if (nombre.includes("pan") || nombre.includes("horno") || nombre.includes("confitería")) {
                iconoEmoji = "🥖";
            } else if (nombre.includes("carn") || nombre.includes("charcut")) {
                iconoEmoji = "🥩";
            }

            // Crear icono personalizado con HTML (Emoji)
            var customIcon = L.divIcon({
                html: `<div style="font-size: 24px;">${iconoEmoji}</div>`,
                className: 'my-custom-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            // Usar el icono nuevo
            var marker = L.marker([local.lat, local.lng], { icon: customIcon });

            marker.bindPopup(`<b>${local.nombre || 'Sin nombre'}</b>`);
            marker.addTo(map);
            markers.addLayer(marker);
        }
    });


    // 4. Ajustar la vista del mapa para que se vean todos los puntos
    if (grupoMarcadores.getLayers().length > 0) {
      map.fitBounds(grupoMarcadores.getBounds(), { padding: [50, 50] });
      console.log("Mapa centrado en los locales.");
    } else {
      console.warn("No se han creado marcadores (revisa lat/lng en el JSON).");
    }

  })
  .catch(error => {
    console.error('Error grave cargando el mapa:', error);
  });

