var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Variables globales para guardar los datos
var todosLosLocales = []; 
var clusterGroup = L.markerClusterGroup({ chunkedLoading: true }); // Un solo grupo para todo (más fácil de limpiar)

map.addLayer(clusterGroup);

console.log("Cargando datos...");

fetch('data/locales_nuevos.json')
    .then(r => r.json())
    .then(locales => {
        todosLosLocales = locales; // Guardamos copia de seguridad
        pintarMapa(todosLosLocales); // Pintamos todo al principio
        console.log("Cargados " + locales.length + " locales.");
    })
    .catch(e => console.error(e));

// Función para pintar una lista de locales en el mapa
function pintarMapa(listaLocales) {
    clusterGroup.clearLayers(); // Borrar lo que haya

    listaLocales.forEach(local => {
        if (local.lat && local.lng) {
            
            // Emoji según categoría
            let cat = local.categoria;
            let emoji = "📍";
            if (cat === "Alimentación") emoji = "🛒";
            else if (cat === "Hostelería") emoji = "☕";
            else if (cat === "Moda") emoji = "👕";

            var icono = L.divIcon({
                html: `<div style="font-size: 25px; text-shadow: 0 0 2px white;">${emoji}</div>`,
                className: 'dummy-class',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            var marker = L.marker([local.lat, local.lng], { icon: icono });
            marker.bindPopup(`<b>${local.nombre}</b><br>${local.tipo_detalle || ''}`);
            clusterGroup.addLayer(marker);
        }
    });
}

// LÓGICA DEL BUSCADOR
function buscarLocales() {
    var texto = document.getElementById("txtBusqueda").value.toLowerCase();
    var distancia = parseInt(document.getElementById("selDistancia").value);

    // 1. Si elige distancia, pedir ubicación al usuario
    if (distancia > 0) {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta GPS");
            return;
        }
        navigator.geolocation.getCurrentPosition(pos => {
            var miLat = pos.coords.latitude;
            var miLng = pos.coords.longitude;
            
            // Dibujar un círculo azul donde estoy
            L.circle([miLat, miLng], { radius: distancia }).addTo(map);
            map.setView([miLat, miLng], 15);

            filtrarDatos(texto, distancia, miLat, miLng);
        }, () => {
            alert("No pudimos localizarte. Buscando en todo Sevilla...");
            filtrarDatos(texto, 0, 0, 0);
        });
    } else {
        // Búsqueda en toda la ciudad
        filtrarDatos(texto, 0, 0, 0);
    }
}

function filtrarDatos(texto, radio, latUser, lngUser) {
    var resultados = todosLosLocales.filter(local => {
        // Filtro por texto (nombre o tipo)
        var coincideTexto = (local.nombre || "").toLowerCase().includes(texto) || 
                            (local.tipo_detalle || "").toLowerCase().includes(texto);
        
        // Filtro por distancia (si aplica)
        var dentroDelRadio = true;
        if (radio > 0) {
            var dist = map.distance([latUser, lngUser], [local.lat, local.lng]);
            dentroDelRadio = dist <= radio;
        }

        return coincideTexto && dentroDelRadio;
    });

    pintarMapa(resultados);
    
    if(resultados.length === 0) alert("No se encontraron locales con ese criterio 😢");
}

function resetMapa() {
    document.getElementById("txtBusqueda").value = "";
    pintarMapa(todosLosLocales);
    map.setView([37.3891, -5.9845], 13);
}
// --- AUTO-LOCALIZACIÓN AL INICIO ---

// Intentar localizar al usuario nada más entrar
if (navigator.geolocation) {
    console.log("Pidiendo ubicación...");
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;

            console.log("Usuario localizado en:", lat, lng);

            // 1. Centrar el mapa en el usuario
            map.setView([lat, lng], 16); // Zoom 16 para ver detalle callejero

            // 2. Poner un marcador especial "YO" (Punto azul pulsante)
            var iconoYo = L.divIcon({
                html: '<div style="width: 15px; height: 15px; background: #4285F4; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
                className: 'user-location-dot',
                iconSize: [20, 20]
            });

            L.marker([lat, lng], { icon: iconoYo })
                .addTo(map)
                .bindPopup("<b>¡Estás aquí!</b>")
                .openPopup();
            
            // 3. Crear un círculo de precisión (radio azul clarito)
            L.circle([lat, lng], {
                color: '#4285F4',
                fillColor: '#4285F4',
                fillOpacity: 0.1,
                radius: 200 // 200 metros alrededor
            }).addTo(map);
        },
        (error) => {
            console.warn("El usuario denegó la ubicación o hubo error:", error.message);
            // No pasa nada, se queda centrado en la Giralda (por defecto)
        }
    );
} else {
    console.log("Este navegador no tiene GPS.");
}

