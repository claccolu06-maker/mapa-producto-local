// Inicializar el mapa centrado en Sevilla
var map = L.map('map').setView([37.3891, -5.9845], 13);

// Capa de mapa base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

console.log("Cargando locales...");

fetch('data/locales.json')
    .then(response => {
        if (!response.ok) throw new Error("Error al cargar JSON");
        return response.json();
    })
    .then(locales => {
        console.log("Locales encontrados:", locales.length);

        var markers = L.featureGroup();

        locales.forEach(local => {
            if (local.lat && local.lng) {
                
                // 1. Decidir qué emoji poner según el nombre
                let nombre = (local.nombre || "").toLowerCase();
                let emoji = "📍"; // Icono por defecto (chincheta roja)

                if (nombre.includes("fruta") || nombre.includes("verdura")) {
                    emoji = "🍎"; // Frutería
                } else if (nombre.includes("pan") || nombre.includes("horno") || nombre.includes("confitería") || nombre.includes("pastelería")) {
                    emoji = "🥖"; // Panadería
                } else if (nombre.includes("carn") || nombre.includes("charcut")) {
                    emoji = "🥩"; // Carnicería
                }

                // 2. Crear el icono "divIcon" que permite usar HTML/Emojis
                var emojiIcon = L.divIcon({
                    html: `<div style="font-size: 25px; text-shadow: 2px 2px 2px white;">${emoji}</div>`,
                    className: '', // Dejar vacío para quitar estilos feos por defecto de Leaflet
                    iconSize: [30, 30],
                    iconAnchor: [15, 15] // Centrar el emoji
                });

                // 3. Crear el marcador con ese icono
                var marker = L.marker([local.lat, local.lng], { icon: emojiIcon });

                marker.bindPopup(`<b>${local.nombre || 'Sin nombre'}</b>`);
                
                marker.addTo(map);
                markers.addLayer(marker);
            }
        });

        // Auto-centrar
        if (markers.getLayers().length > 0) {
            map.fitBounds(markers.getBounds());
        }
    })
    .catch(error => console.error('Error:', error));
