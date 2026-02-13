// =============================
// UTIL: NORMALIZAR TEXTO
// =============================
function normalizarTexto(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .toLowerCase()
    .trim();
}

// =============================
// MAPA Y CONTROLES
// =============================
var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Botón Filtro arriba a la derecha
const filtroControl = L.control({ position: 'topright' });

filtroControl.onAdd = function (map) {
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

// Mostrar / ocultar panel de filtros (index.html tiene #panelFiltro)
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "btnFiltroMapa") {
    e.preventDefault();
    const panel = document.getElementById("panelFiltro");
    if (!panel) return;
    panel.style.display =
      (panel.style.display === "none" || panel.style.display === "") ? "block" : "none";
  }
});

// =============================
// VARIABLES GLOBALES
// =============================
var todosLosLocales = [];
var clusterGroup = L.markerClusterGroup({
  chunkedLoading: true,
  removeOutsideVisibleBounds: true,
  disableClusteringAtZoom: 17,
  showCoverageOnHover: false
});
map.addLayer(clusterGroup);

// localesFiltrados = salida de filtros/búsquedas
// localesVisibles   = filtrados que están dentro de los bounds del mapa
var localesFiltrados = [];
var localesVisibles = [];

// =============================
// CARGAR LOCALES
// =============================
console.log("Cargando datos...");

fetch('locales.json')
  .then(r => r.json())
  .then(locales => {
    todosLosLocales = locales;

    locales.forEach(local => {
      if (local.precio) local.precioStr = "★".repeat(local.precio);
    });

    localesFiltrados = todosLosLocales; // al inicio, todos
    recalcularLocalesVisibles();

    rellenarBarrios();
    console.log("Cargados " + locales.length + " locales con formulario.");
  })
  .catch(e => console.error(e));

// Al mover / hacer zoom, recalcular visibles
map.on("moveend", () => {
  recalcularLocalesVisibles();
});

// =============================
// PINTAR MAPA (HARDCORE)
// =============================
function crearMarkerDesdeLocal(local) {
  let cat = local.categoria;
  let emoji = "📍";
  if (cat === "Alimentación") emoji = "🛒";
  else if (cat === "Hostelería") emoji = "☕";
  else if (cat === "Moda") emoji = "👕";
  else if (cat === "Salud") emoji = "💊";

  var icono = L.divIcon({
    html: `<div style="font-size: 25px; text-shadow: 0 0 2px white;">${emoji}</div>`,
    className: 'dummy-class',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  var marker = L.marker([local.lat, local.lng], { icon: icono });

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
  return marker;
}

function pintarMapa(listaLocales) {
  clusterGroup.clearLayers();

  const markers = [];

  listaLocales.forEach(local => {
    if (!local.lat || !local.lng) return;
    const marker = crearMarkerDesdeLocal(local);
    markers.push(marker);
  });

  clusterGroup.addLayers(markers);
}

// Recalcular qué locales de localesFiltrados están dentro de la vista
function recalcularLocalesVisibles() {
  if (!localesFiltrados.length) {
    localesVisibles = [];
    clusterGroup.clearLayers();
    return;
  }

  const bounds = map.getBounds();

  localesVisibles = localesFiltrados.filter(l =>
    l.lat && l.lng && bounds.contains([l.lat, l.lng])
  );

  pintarMapa(localesVisibles);
}

// =============================
// AUTOCOMPLETAR BARRIOS
// =============================
function rellenarBarrios() {
  const setBarrios = new Set();

  todosLosLocales.forEach(l => {
    if (l.barrio) {
      setBarrios.add(l.barrio.trim());
    }
  });

  const datalist = document.getElementById("listaBarrios");
  if (!datalist) return;

  datalist.innerHTML = "";

  Array.from(setBarrios).sort().forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    datalist.appendChild(opt);
  });
}

// =============================
// FILTRO AVANZADO (PANEL)
// =============================
function aplicarFiltroMapa() {
  const cat = document.getElementById("fCategoria").value;
  const precioMin = parseInt(document.getElementById("fPrecioMin").value) || null;
  const precioMax = parseInt(document.getElementById("fPrecioMax").value) || null;
  const barrioTxt = document.getElementById("fBarrio").value;
  const soloAbiertos = document.getElementById("fSoloAbiertos").checked;

  let filtrados = todosLosLocales.filter(local => {
    if (cat && local.categoria !== cat) return false;
    if (precioMin !== null && (local.precio || 0) < precioMin) return false;
    if (precioMax !== null && (local.precio || 0) > precioMax) return false;

    if (barrioTxt) {
      const bNorm = normalizarTexto(local.barrio);
      const filtroNorm = normalizarTexto(barrioTxt);
      if (!bNorm.includes(filtroNorm)) return false;
    }

    if (soloAbiertos && local.horario_abierto === false) return false;

    return true;
  });

  if (filtrados.length === 0) {
    alert("No se han encontrado locales con esos criterios.");
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const latUser = pos.coords.latitude;
        const lngUser = pos.coords.longitude;

        filtrados.forEach(l => {
          if (l.lat && l.lng) {
            l._dist = map.distance([latUser, lngUser], [l.lat, l.lng]);
          } else {
            l._dist = Infinity;
          }
        });

        filtrados.sort((a, b) => a._dist - b._dist);

        if (filtrados.length > 200) {
          filtrados = filtrados.slice(0, 200);
        }

        localesFiltrados = filtrados;
        recalcularLocalesVisibles();

        const primero = filtrados[0];
        if (primero && primero.lat && primero.lng) {
          map.setView([primero.lat, primero.lng], 15);
        }
      },
      () => {
        localesFiltrados = filtrados;
        recalcularLocalesVisibles();
      }
    );
  } else {
    localesFiltrados = filtrados;
    recalcularLocalesVisibles();
  }
}

// =============================
// BUSCADOR RÁPIDO (CAJA IZQ)
// =============================
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
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

  localesFiltrados = resultados;
  recalcularLocalesVisibles();

  if (resultados.length === 0) {
    alert(`No encontrado 😢. Prueba con "bar", "tapas" o "comida".`);
  }
}

function buscarLocales() {
  var texto = document.getElementById("txtBusqueda").value;
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

function resetMapa() {
  document.getElementById("txtBusqueda").value = "";
  document.getElementById("selDistancia").value = "0";
  localesFiltrados = todosLosLocales;
  recalcularLocalesVisibles();
  map.setView([37.3891, -5.9845], 13);
}

// =============================
// AUTO-LOCALIZACIÓN INICIAL
// =============================
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

// =============================
// EVENTOS DOM
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const btnFiltro = document.getElementById("btnAplicarFiltro");
  if (btnFiltro) btnFiltro.addEventListener("click", aplicarFiltroMapa);

  const btnQuitar = document.getElementById("btnQuitarFiltro");
  if (btnQuitar) btnQuitar.addEventListener("click", () => {
    document.getElementById("fCategoria").value = "";
    document.getElementById("fPrecioMin").value = "";
    document.getElementById("fPrecioMax").value = "";
    document.getElementById("fBarrio").value = "";
    document.getElementById("fSoloAbiertos").checked = false;
    localesFiltrados = todosLosLocales;
    recalcularLocalesVisibles();
  });
});
