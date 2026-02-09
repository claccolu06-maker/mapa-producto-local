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

fetch('https://claccolu06-maker.github.io/mapa-producto-local/locales.json')
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

// Diccionario de "sinónimos" para ayudar al buscador
const sinonimos = {
    "restaurante": "restaurant",
    "tienda": "shop",
    "cafeteria": "cafe",
    "fruteria": "greengrocer",
    "panaderia": "bakery",
    "carniceria": "butcher",
    "ropa": "clothes",
    "super": "supermarket"
};

function normalizar(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function filtrarDatos(texto, radio, latUser, lngUser) {
    var textoUser = normalizar(texto);
    
    // Si el usuario escribe "restaurante", buscamos también "restaurant"
    var textoTecnico = sinonimos[textoUser] || textoUser;

    var resultados = todosLosLocales.filter(local => {
        var nombre = normalizar(local.nombre || "");
        var tipo = normalizar(local.tipo_detalle || "");     // Ej: "restaurant"
        var categoria = normalizar(local.categoria || "");   // Ej: "hostelería"

        // Buscamos si coincide con lo que escribió el usuario O con su traducción técnica
        var coincideTexto = nombre.includes(textoUser) || 
                            tipo.includes(textoUser) || 
                            categoria.includes(textoUser) ||
                            // Aquí está la magia: buscamos también el término en inglés
                            tipo.includes(textoTecnico);
        
        // Filtro de distancia
        var dentroDelRadio = true;
        if (radio > 0) {
            var dist = map.distance([latUser, lngUser], [local.lat, local.lng]);
            dentroDelRadio = dist <= radio;
        }

        return coincideTexto && dentroDelRadio;
    });

    console.log(`Buscando: "${textoUser}" (o "${textoTecnico}") | Resultados: ${resultados.length}`);
    
    pintarMapa(resultados);
    
    if(resultados.length === 0) {
        alert(`No encontrado 😢. Prueba con "bar", "tapas" o "comida".`);
    }
}
// ================================
// PREFERENCIAS DE USUARIO (MAPA)
// ================================
function leerPreferenciasUsuario() {
    try {
        const raw = localStorage.getItem('preferencias_mapa');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn("No se pudieron leer las preferencias:", e);
        return null;
    }
}

function aplicarPreferenciasEnBuscador() {
    const pref = leerPreferenciasUsuario();
    if (!pref) return;

    // Tu formulario guarda: Alimentación, Hostelería, Moda, Otros
    let textoBuscador = "";
    switch (pref.categoriaFavorita) {
        case "Alimentación":
            textoBuscador = "super";  // supermercados / alimentación
            break;
        case "Hostelería":
            textoBuscador = "comer";  // bares + restaurantes
            break;
        case "Moda":
            textoBuscador = "ropa";   // tiendas de ropa
            break;
        default:
            textoBuscador = "";
    }

    if (textoBuscador) {
        const input = document.getElementById('buscador');
        if (input) {
            input.value = textoBuscador;
        }
    }
}
// ================================
// FILTROS AVANZADOS (desde filtros.html)
// ================================
function leerFiltrosMapa() {
    try {
        const raw = localStorage.getItem('filtros_mapa');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn("No se pudieron leer los filtros del mapa:", e);
        return null;
    }
}

// Aplica tipo y radio a la UI del mapa
function aplicarFiltrosEnUI() {
    const filtros = leerFiltrosMapa();
    if (!filtros) return;

    // 1) Tipo -> texto del buscador
    if (filtros.tipo) {
        const buscador = document.getElementById('buscador');
        if (buscador) {
            buscador.value = filtros.tipo; // "comer", "super", "ropa", "salud"
        }
    }

    // 2) Radio -> select de distancia (si existe)
    const distanciaSelect = document.getElementById('distancia');
    if (distanciaSelect && typeof filtros.radio !== "undefined") {
        const valor = String(filtros.radio);
        // Solo cambiamos si existe esa opción
        const optionExiste = Array.from(distanciaSelect.options).some(opt => opt.value === valor);
        if (optionExiste) {
            distanciaSelect.value = valor;
        }
    }

    // 3) En el futuro podríamos usar filtros.soloAbiertos cuando tengas horarios en el JSON
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
// ================================
// ARRANQUE AUTOMÁTICO CON PREFERENCIA
// ================================
document.addEventListener('DOMContentLoaded', () => {
    aplicarPreferenciasEnBuscador();

    const inputBuscador = document.getElementById('buscador');
    if (!inputBuscador) return;

    const texto = inputBuscador.value;
    if (!texto) return; // si no hay preferencia, no hacemos nada

    // Opcional: si quieres que además busque solo, copia la lógica de tu botón:
    const distanciaSelect = document.getElementById('distancia');
    const radio = distanciaSelect ? parseInt(distanciaSelect.value) || 0 : 0;

    if (radio > 0 && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const latUser = pos.coords.latitude;
            const lngUser = pos.coords.longitude;
            map.setView([latUser, lngUser], 15);
            filtrarDatos(texto, radio, latUser, lngUser);
        }, err => {
            console.warn("No se pudo obtener ubicación para búsqueda inicial:", err);
            filtrarDatos(texto, 0, 0, 0);
        });
    } else {
        filtrarDatos(texto, 0, 0, 0);
    }
});

// Botón que abre la página de filtros avanzados
const btnFiltrarAvanzado = document.getElementById('btn-filtrar-avanzado');
if (btnFiltrarAvanzado) {
    btnFiltrarAvanzado.addEventListener('click', () => {
        window.location.href = "filtros.html"; // nueva página de filtros
    });
}
// ================================
// ARRANQUE AUTOMÁTICO CON FILTROS
// ================================
document.addEventListener('DOMContentLoaded', () => {
    aplicarFiltrosEnUI(); // Rellena buscador y radio si hay filtros

    const buscador = document.getElementById('buscador');
    if (!buscador) return;

    const texto = buscador.value.trim();
    if (!texto) return; // si no hay tipo elegido, no hacemos nada

    const distanciaSelect = document.getElementById('distancia');
    const radio = distanciaSelect ? parseInt(distanciaSelect.value) || 0 : 0;

    // Igual que al pulsar el botón Buscar:
    if (radio > 0 && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const latUser = pos.coords.latitude;
            const lngUser = pos.coords.longitude;
            map.setView([latUser, lngUser], 15);
            filtrarDatos(texto, radio, latUser, lngUser);
        }, err => {
            console.warn("No se pudo obtener ubicación para búsqueda inicial:", err);
            filtrarDatos(texto, 0, 0, 0);
        });
    } else {
        filtrarDatos(texto, 0, 0, 0);
    }
});
const btnFiltrarAvanzado = document.getElementById('btn-filtrar-avanzado');
if (btnFiltrarAvanzado) {
    btnFiltrarAvanzado.addEventListener('click', () => {
        window.location.href = "filtros.html";
    });
}




