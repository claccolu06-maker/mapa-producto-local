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
      // Verificar que tenga coordenadas válidas
      if (local.lat && local.lng) {
        
        // Crear el marcador (azul por defecto)
        var marker = L.marker([local.lat, local.lng]);

        // Añadir popup con el nombre (o "Sin nombre" si no tiene)
        marker.bindPopup(`<b>${local.nombre || 'Local sin nombre'}</b>`);

        // Añadir al mapa y al grupo
        marker.addTo(map);
        grupoMarcadores.addLayer(marker);
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
