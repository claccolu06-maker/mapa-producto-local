// 1. Inicializar mapa
var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 2. Grupos de capas
var grupoFruterias = L.layerGroup().addTo(map);
var grupoPanaderias = L.layerGroup().addTo(map);
var grupoCarnicerias = L.layerGroup().addTo(map);
var grupoOtros = L.layerGroup().addTo(map);

console.log("Cargando datos...");

fetch('data/locales.json')
    .then(r => r.json())
    .then(locales => {
        locales.forEach(local => {
            if (local.lat && local.lng) {
                
                let nombre = (local.nombre || "").toLowerCase();
                let destino = grupoOtros;
                let emoji = "📍"; 

                if (nombre.includes("frut") || nombre.includes("verdura")) {
                    destino = grupoFruterias;
                    emoji = "🍎";
                } 
                else if (nombre.includes("pan") || nombre.includes("horno") || nombre.includes("confitería") || nombre.includes("pastelería")) {
                    destino = grupoPanaderias;
                    emoji = "🥖";
                } 
                else if (nombre.includes("carn") || nombre.includes("charcut")) {
                    destino = grupoCarnicerias;
                    emoji = "🥩";
                }

                // TRUCO FINAL: Usar un DivIcon con estilo inline agresivo
                // y clase 'dummy' para que Leaflet no ponga su cuadrado por defecto
                var icono = L.divIcon({
                    html: `<div style="font-size: 30px; text-align: center; line-height: 1;">${emoji}</div>`,
                    className: 'leaflet-data-marker', // Nombre inventado para que no coja estilos por defecto
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                var marker = L.marker([local.lat, local.lng], { icon: icono });
                marker.bindPopup(`<b>${local.nombre}</b>`);
                marker.addTo(destino);
            }
        });

        // Control de capas
        var overlayMaps = {
            "🍎 Fruterías": grupoFruterias,
            "🥖 Panaderías": grupoPanaderias,
            "🥩 Carnicerías": grupoCarnicerias,
            "📍 Otros": grupoOtros
        };
        L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);
    })
    .catch(e => console.error(e));
