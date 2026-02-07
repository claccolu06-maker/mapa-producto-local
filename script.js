// 1. Inicializar el mapa
var map = L.map('map').setView([37.3891, -5.9845], 13);

// Capa base (el mapa de fondo)
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 2. Crear grupos vacíos para cada categoría
var grupoFruterias = L.layerGroup();
var grupoPanaderias = L.layerGroup();
var grupoCarnicerias = L.layerGroup();
var grupoOtros = L.layerGroup(); // Para lo que no sepamos qué es

console.log("Cargando datos...");

fetch('data/locales.json')
    .then(r => r.json())
    .then(locales => {
        console.log("Procesando " + locales.length + " locales...");

        locales.forEach(local => {
            if (local.lat && local.lng) {
                
                // Detectar tipo por el nombre
                let nombre = (local.nombre || "").toLowerCase();
                let destino = grupoOtros; // Por defecto a "Otros"
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

                // Crear icono (Intentamos Emojis, si falla se verá un cuadrado pero funcionará)
               // Crear icono de texto puro (Emoji)
var icono = L.divIcon({
    html: `<div style="font-size: 30px; line-height: 30px; text-align: center;">${emoji}</div>`,
    className: 'emoji-icon', // Usamos una clase nueva
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});
                // Crear marcador y añadirlo al GRUPO correspondiente (no al mapa directamente)
                var marker = L.marker([local.lat, local.lng], { icon: icono });
                marker.bindPopup(`<b>${local.nombre || 'Sin nombre'}</b>`);
                
                marker.addTo(destino);
            }
        });

        // 3. Añadir las capas al mapa para que se vean al cargar
        grupoFruterias.addTo(map);
        grupoPanaderias.addTo(map);
        grupoCarnicerias.addTo(map);

        // 4. Crear el MENÚ DE CONTROL (arriba a la derecha)
        var overlayMaps = {
            "🍎 Fruterías": grupoFruterias,
            "🥖 Panaderías": grupoPanaderias,
            "🥩 Carnicerías": grupoCarnicerias,
            "📍 Otros": grupoOtros
        };

        L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);
        
        console.log("Filtros activados.");

    })
    .catch(e => console.error("Error:", e));

