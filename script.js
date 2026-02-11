var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Control personalizado arriba a la derecha: botón Filtro
const filtroControl = L.control({ position: 'topright' });

filtroControl.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

    div.innerHTML = `
      <a href="#" id="btnFiltroMapa" title="Buscar local"
         style="display:flex;align-items:center;justify-content:center;
                width:32px;height:32px;font-size:18px;text-decoration:none;">
        🔍
      </a>
    `;

    L.DomEvent.disableClickPropagation(div);
    return div;
};

filtroControl.addTo(map);

// Variables globales
var todosLosLocales = [];
var clusterGroup = L.markerClusterGroup({ chunkedLoading: true });
map.addLayer(clusterGroup);

console.log("Cargando datos...");

// Leer locales.json
fetch('locales.json')
    .then(r => r.json())
    .then(locales => {
        todosLosLocales = locales;

        locales.forEach(local => {
            if (local.precio) local.precioStr = "★".repeat(local.precio);
        });

        pintarMapa(todosLosLocales);
        console.log("Cargados " + locales.length + " locales con formulario.");
    })
    .catch(e => console.error(e));

// Pintar lista de locales
function pintarMapa(listaLocales) {
    clusterGroup.clearLayers();

    listaLocales.forEach(local => {
        if (local.lat && local.lng) {
            let cat = local.categoria;
            let emoji = "📍";
            if (cat === "Alimentación") emoji = "🛒";
            else if (cat === "Hostelería") emoji = "☕";
            else if (cat === "Moda") emoji = "👕";
            else if (cat === "Salud") emoji = "💊";  // NUEVO

            var icono = L.divIcon({
                html: `<div style="font-size: 25px; text-shadow: 0 0 2px white;">${emoji}</div>`,
                className: 'dummy-class',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            var marker = L.marker([local.lat, local.lng], { icon: icono });

// Popup limpio + enlace a Google Maps
let precioTexto = local.precioStr ? local.precioStr : "Sin datos";
let horarioTexto = (local.horario_abierto === true) ? "Abierto ahora" :
                   (local.horario_abierto === false) ? "Cerrado" : "Sin datos";

let linkGM = "";
if (local.lat && local.lng) {
    const q = encodeURIComponent(`${local.nombre || ""} ${local.direccion || ""}`);
    linkGM = `<a href="https://www.google.com/maps/search/?api=1&query=${local.lat},${local.lng} (${q})" target="_blank" style="color:#1a73e8;">Ver en Google Maps</a>`;
}

let popupContent = `
  <div style="min-width: 180px; font-size: 0.9rem;">
    <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">
      ${local.nombre || "Sin nombre"}
    </div>
    <div style="color:#555; margin-bottom: 6px;">
      ${local.categoria ? local.categoria + " · " : ""}${local.tipo_detalle || ""}
    </div>
    <div style="margin-bottom: 4px;">
      <strong>Precio:</strong> ${precioTexto}
    </div>
    <div style="margin-bottom: 4px;">
      <strong>Barrio:</strong> ${local.barrio || "Sin datos"}
    </div>
    <div style="margin-bottom: 4px;">
      <strong>Dirección:</strong> ${local.direccion || "Sin datos"}
    </div>
    <div style="margin-bottom: 6px;">
      <strong>Horario:</strong> ${horarioTexto}
    </div>
    <div style="margin-top: 6px;">
      ${linkGM}
    </div>
  </div>
`;

marker.bindPopup(popupContent);
clusterGroup.addLayer(marker);
        }
    });
}

// Filtro desde el panel pequeño
function aplicarFiltroMapa() {
    const cat = document.getElementById("fCategoria").value;
    const precioMin = parseInt(document.getElementById("fPrecioMin").value) || null;
    const precioMax = parseInt(document.getElementById("fPrecioMax").value) || null;
    const barrioTxt = document.getElementById("fBarrio").value.trim().toLowerCase();
    const soloAbiertos = document.getElementById("fSoloAbiertos").checked;

    const filtraBase = (local) => {
        if (cat && local.categoria !== cat) return false;
        if (precioMin !== null && (local.precio || 0) < precioMin) return false;
        if (precioMax !== null && (local.precio || 0) > precioMax) return false;
        if (barrioTxt) {
            const b = (local.barrio || "").toLowerCase();
            if (!b.includes(barrioTxt)) return false;
        }
        if (soloAbiertos && local.horario_abierto === false) return false;
        return true;
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const latUser = pos.coords.latitude;
            const lngUser = pos.coords.longitude;

            let filtrados = todosLosLocales.filter(filtraBase);

            filtrados.forEach(l => {
                if (l.lat && l.lng) {
                    l._dist = map.distance([latUser, lngUser], [l.lat, l.lng]);
                } else {
                    l._dist = Infinity;
                }
            });
            filtrados.sort((a, b) => a._dist - b._dist);
            filtrados = filtrados.slice(0, 30);

            pintarMapa(filtrados);

            if (filtrados.length > 0) {
                const primero = filtrados[0];
                map.setView([primero.lat, primero.lng], 15);
            } else {
                alert("No se han encontrado locales con esos criterios.");
            }
        }, () => {
            alert("No se pudo obtener tu ubicación. Se aplican filtros sin cercanía.");
            let filtrados = todosLosLocales.filter(filtraBase);
            pintarMapa(filtrados);
        });
    } else {
        alert("Tu navegador no permite localizarte. Se aplican filtros sin cercanía.");
        let filtrados = todosLosLocales.filter(filtraBase);
        pintarMapa(filtrados);
    }
}
function mostrarTodosLocales() {
    pintarMapa(todosLosLocales);
    map.setView([37.3891, -5.9845], 13);
}

// Buscador antiguo (igual que antes)
function buscarLocales() {
    var texto = document.getElementById("txtBusqueda").value.toLowerCase();
    var distancia = parseInt(document.getElementById("selDistancia").value);

    if (distancia > 0) {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta GPS");
            return;
        }
        navigator.geolocation.getCurrentPosition(pos => {
            var miLat = pos.coords.latitude;
            var miLng = pos.coords.longitude;

            L.circle([miLat, miLng], { radius: distancia }).addTo(map);
            map.setView([miLat, miLng], 15);

            filtrarDatos(texto, distancia, miLat, miLng);
        }, () => {
            alert("No pudimos localizarte. Buscando en todo Sevilla...");
            filtrarDatos(texto, 0, 0, 0);
        });
    } else {
        filtrarDatos(texto, 0, 0, 0);
    }
}

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
    return texto.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
}

function filtrarDatos(texto, radio, latUser, lngUser) {
    var textoUser = normalizar(texto);
    var textoTecnico = sinonimos[textoUser] || textoUser;

    var resultados = todosLosLocales.filter(local => {
        var nombre = normalizar(local.nombre || "");
        var tipo = normalizar(local.tipo_detalle || "");
        var categoria = normalizar(local.categoria || "");

        var coincideTexto = nombre.includes(textoUser) ||
                            tipo.includes(textoUser) ||
                            categoria.includes(textoUser) ||
                            tipo.includes(textoTecnico);

        var dentroDelRadio = true;
        if (radio > 0) {
            var dist = map.distance([latUser, lngUser], [local.lat, local.lng]);
            dentroDelRadio = dist <= radio;
        }

        return coincideTexto && dentroDelRadio;
    });

    console.log(`Buscando: "${textoUser}" | Resultados: ${resultados.length}`);
    pintarMapa(resultados);

    if (resultados.length === 0) {
        alert(`No encontrado 😢. Prueba con "bar", "tapas" o "comida".`);
    }
}

function resetMapa() {
    document.getElementById("txtBusqueda").value = "";
    pintarMapa(todosLosLocales);
    map.setView([37.3891, -5.9845], 13);
}

// Auto-localización
if (navigator.geolocation) {
    console.log("Pidiendo ubicación...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;

            console.log("Usuario localizado en:", lat, lng);

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
                radius: 200
            }).addTo(map);
        },
        (error) => {
            console.warn("El usuario denegó la ubicación o hubo error:", error.message);
        }
    );
}

// Conectar botón del panel con la función de filtro
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnAplicarFiltro");
    if (btn) {
        btn.addEventListener("click", aplicarFiltroMapa);
    }
});
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnAplicarFiltro");
    if (btn) btn.addEventListener("click", aplicarFiltroMapa);

    const btnQuitar = document.getElementById("btnQuitarFiltro");
    if (btnQuitar) btnQuitar.addEventListener("click", () => {
        document.getElementById("fCategoria").value = "";
        document.getElementById("fPrecioMin").value = "";
        document.getElementById("fPrecioMax").value = "";
        document.getElementById("fBarrio").value = "";
        document.getElementById("fSoloAbiertos").checked = false;
        mostrarTodosLocales();
    });
});




