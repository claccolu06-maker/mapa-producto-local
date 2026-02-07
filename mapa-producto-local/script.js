// ==========================================
// CONFIGURACIÓN DE CATEGORÍAS ("DICCIONARIO")
// ==========================================
const CATEGORIAS_MAESTRAS = {
    // COMER Y BEBER
    "bar":        ["bar", "pub", "biergarten", "cafe"],
    "copas":      ["pub", "bar", "nightclub"],
    "restaurante":["restaurant", "food_court", "fast_food"],
    "comer":      ["restaurant", "fast_food", "food_court", "bar", "pub", "cafe"],
    "cafe":       ["cafe"],
    
    // COMPRAS
    "super":      ["supermarket", "convenience"],
    "tienda":     ["shop", "clothes", "shoes", "electronics", "bakery", "butcher", "greengrocer"],
    "ropa":       ["clothes", "fashion", "shoes"],
    "pan":        ["bakery"],

    // SERVICIOS
    "banco":      ["bank", "atm"],
    "salud":      ["pharmacy", "hospital", "dentist", "doctors"],
    "farmacia":   ["pharmacy"],
    "turismo":    ["hotel", "hostel", "museum", "artwork", "attraction"]
};

// ==========================================
// 1. INICIALIZAR EL MAPA
// ==========================================
var map = L.map('map').setView([37.3886, -5.9823], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

var todosLosLocales = [];
var marcadoresActuales = L.layerGroup().addTo(map);

// ==========================================
// 2. CARGAR DATOS (Corrección aquí)
// ==========================================
fetch('locales.json') // <--- ¡AQUÍ ESTABA EL CAMBIO!
    .then(response => {
        if (!response.ok) {
            throw new Error("No se pudo cargar el archivo JSON. Verifica el nombre.");
        }
        return response.json();
    })
    .then(data => {
        todosLosLocales = data;
        console.log("¡Datos cargados!", todosLosLocales.length, "locales listos.");
        pintarMapa(todosLosLocales); 
    })
    .catch(error => console.error('Error cargando el JSON:', error));

// ==========================================
// 3. FUNCIONES DE BÚSQUEDA Y FILTRADO
// ==========================================

function normalizar(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function filtrarDatos(texto, radio, latUser, lngUser) {
    var inputUsuario = normalizar(texto);
    var etiquetasBuscadas = CATEGORIAS_MAESTRAS[inputUsuario] || [];

    var resultados = todosLosLocales.filter(local => {
        var nombre = normalizar(local.nombre || "");
        var tipoOSM = normalizar(local.tipo_detalle || "");
        var categoria = normalizar(local.categoria || "");

        var coincide = false;

        // A) ¿Es una Categoría Maestra?
        if (etiquetasBuscadas.length > 0) {
            if (etiquetasBuscadas.includes(tipoOSM)) {
                coincide = true;
            }
        } 
        // B) Si no, búsqueda normal
        else {
            if (nombre.includes(inputUsuario) || tipoOSM.includes(inputUsuario) || categoria.includes(inputUsuario)) {
                coincide = true;
            }
        }
        
        // C) Filtro de Distancia
        var dentroDelRadio = true;
        if (radio > 0) {
            var latitud = local.lat || local.latitude;    // Soporte para ambos nombres
            var longitud = local.lng || local.lon || local.longitude; 
            var dist = map.distance([latUser, lngUser], [latitud, longitud]);
            dentroDelRadio = dist <= radio;
        }

        return coincide && dentroDelRadio;
    });

    console.log(`Buscando: "${inputUsuario}" | Encontrados: ${resultados.length}`);
    pintarMapa(resultados);

    if(resultados.length === 0) {
        console.log("No se encontraron resultados cercanos.");
    }
}

function pintarMapa(locales) {
    marcadoresActuales.clearLayers();

    locales.forEach(local => {
        var color = '#3388ff';
        if (local.categoria === 'hosteleria') color = '#e74c3c';
        if (local.categoria === 'compras') color = '#27ae60';
        if (local.categoria === 'salud') color = '#8e44ad';

        // Aseguramos leer bien las coordenadas
        var latitud = local.lat || local.latitude;
        var longitud = local.lng || local.lon || local.longitude;

        if (latitud && longitud) {
            var circle = L.circleMarker([latitud, longitud], {
                radius: 6,
                fillColor: color,
                color: "#fff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });

            var contenidoPopup = `
                <b>${local.nombre || "Sin nombre"}</b><br>
                <i>${local.tipo_detalle || ""}</i><br>
                ${local.direccion || ""}
            `;
            
            circle.bindPopup(contenidoPopup);
            marcadoresActuales.addLayer(circle);
        }
    });
}

// ==========================================
// 4. EVENTOS
// ==========================================
document.getElementById('btn-buscar').addEventListener('click', function() {
    var texto = document.getElementById('buscador').value;
    var radio = parseInt(document.getElementById('distancia').value);

    if (radio > 0) {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta GPS.");
            return;
        }
        navigator.geolocation.getCurrentPosition(position => {
            var latUser = position.coords.latitude;
            var lngUser = position.coords.longitude;
            map.setView([latUser, lngUser], 15);
            filtrarDatos(texto, radio, latUser, lngUser);
        }, error => {
            alert("Necesitamos tu ubicación para filtrar por distancia.");
        });
    } else {
        filtrarDatos(texto, 0, 0, 0);
    }
});

document.getElementById('buscador').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('btn-buscar').click();
    }
});

// ==========================================
// 5. AUTO-LOCALIZACIÓN
// ==========================================
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            map.setView([lat, lng], 16);

            var iconoYo = L.divIcon({
                html: '<div style="width: 15px; height: 15px; background: #4285F4; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
                className: 'user-location-dot',
                iconSize: [20, 20]
            });

            L.marker([lat, lng], { icon: iconoYo })
                .addTo(map)
                .bindPopup("<b>¡Estás aquí!</b>")
                .openPopup();
            
            L.circle([lat, lng], {
                color: '#4285F4',
                fillColor: '#4285F4',
                fillOpacity: 0.1,
                radius: 300
            }).addTo(map);
        }
    );
}
