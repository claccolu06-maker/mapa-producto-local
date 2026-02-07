// Inicializar mapa
var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// CREAR GRUPOS DE CLUSTERING (Bolitas que agrupan)
// Uno para cada categoría, así podemos filtrarlos
var clusterAlimentacion = L.markerClusterGroup();
var clusterHosteleria   = L.markerClusterGroup();
var clusterModa         = L.markerClusterGroup();
var clusterOtros        = L.markerClusterGroup();

console.log("Cargando 4.500+ locales...");

fetch('data/locales.json')
    .then(r => r.json())
    .then(locales => {
        console.log(`Procesando ${locales.length} puntos...`);

        locales.forEach(local => {
            if (local.lat && local.lng) {
                
                let cat = local.categoria; // El script Python ya nos dio la categoría
                let destino = clusterOtros;
                let emoji = "📍"; 

                // Asignar grupo y emoji según la categoría que trajo Python
                if (cat === "Alimentación") {
                    destino = clusterAlimentacion;
                    emoji = "🛒";
                } else if (cat === "Hostelería") {
                    destino = clusterHosteleria;
                    emoji = "☕";
                } else if (cat === "Moda") {
                    destino = clusterModa;
                    emoji = "👕";
                }

                // Icono simple
                var icono = L.divIcon({
                    html: `<div style="font-size: 24px;">${emoji}</div>`,
                    className: 'dummy-class', // Clase vacía para evitar estilos default
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                var marker = L.marker([local.lat, local.lng], { icon: icono });
                marker.bindPopup(`<b>${local.nombre}</b><br><i>${local.tipo_detalle}</i>`);
                
                // Añadir al cluster correspondiente
                destino.addLayer(marker);
            }
        });

        // Añadir clusters al mapa
        map.addLayer(clusterAlimentacion);
        map.addLayer(clusterHosteleria);
        map.addLayer(clusterModa);
        map.addLayer(clusterOtros);

        // Control de capas
        var overlayMaps = {
            "🛒 Alimentación": clusterAlimentacion,
            "☕ Hostelería": clusterHosteleria,
            "👕 Moda": clusterModa,
            "📍 Otros": clusterOtros
        };
        L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);

        console.log("¡Mapa cargado!");
    })
    .catch(e => console.error(e));
