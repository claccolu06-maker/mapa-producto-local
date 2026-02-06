// 1. Mapa centrado en Sevilla
var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 2. Cargar datos
fetch('data/locales.json')
    .then(r => r.json())
    .then(locales => {
        var markers = L.featureGroup();

        locales.forEach(local => {
            if (local.lat && local.lng) {
                // Lógica simple de emojis
                let nombre = (local.nombre || "").toLowerCase();
                let emoji = "📍"; 

                if (nombre.includes("frut") || nombre.includes("verdura")) emoji = "🍎";
                else if (nombre.includes("pan") || nombre.includes("horno") || nombre.includes("confitería")) emoji = "🥖";
                else if (nombre.includes("carn") || nombre.includes("charcut")) emoji = "🥩";

                // Icono
                var icon = L.divIcon({
                    html: `<div style="font-size: 24px;">${emoji}</div>`,
                    className: '', 
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                var marker = L.marker([local.lat, local.lng], { icon: icon });
                marker.bindPopup(`<b>${local.nombre}</b>`);
                marker.addTo(map);
                markers.addLayer(marker);
            }
        });

        map.fitBounds(markers.getBounds());
    })
    .catch(e => console.error(e));
