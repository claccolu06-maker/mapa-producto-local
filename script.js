// =============================
// VARIABLES GLOBALES
// =============================
let map;
let markersCluster;
let todosLosLocales = [];

// =============================
// INICIALIZAR MAPA
// =============================
function initMapa() {
  map = L.map("map").setView([37.3891, -5.9845], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  markersCluster = L.markerClusterGroup();
  map.addLayer(markersCluster);

  // Botón para abrir el panel de filtro
  L.Control.Filtro = L.Control.extend({
    onAdd: function () {
      const btn = L.DomUtil.create("button", "leaflet-bar");
      btn.id = "btnFiltroMapa";
      btn.innerHTML = "🔍";
      btn.title = "Filtros avanzados";
      btn.style.background = "#fff";
      btn.style.cursor = "pointer";
      return btn;
    }
  });

  L.control.filtro = function (opts) {
    return new L.Control.Filtro(opts);
  };

  L.control.filtro({ position: "topright" }).addTo(map);
}

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
// PINTAR LOCALES EN EL MAPA
// =============================
function pintarMapa(lista) {
  markersCluster.clearLayers();

  lista.forEach(local => {
    if (!local.lat || !local.lng) return;

    const marker = L.marker([local.lat, local.lng]);

    const categoria = local.categoria || "";
    const nombre = local.nombre || "Sin nombre";
    const barrio = local.barrio || "";
    const precio = local.precio ? "★".repeat(local.precio) : "Sin dato";

    const popupHtml = `
      <strong>${nombre}</strong><br>
      <em>${categoria}</em><br>
      Barrio: ${barrio}<br>
      Precio: ${precio}
    `;

    marker.bindPopup(popupHtml);
    markersCluster.addLayer(marker);
  });
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
// CARGAR LOCALES.JSON
// =============================
function cargarLocales() {
  fetch("locales.json")
    .then(r => r.json())
    .then(data => {
      todosLosLocales = data;
      pintarMapa(todosLosLocales);
      rellenarBarrios();
    })
    .catch(err => {
      console.error("Error cargando locales.json", err);
    });
}

// =============================
// BÚSQUEDA RÁPIDA (CAJA IZQUIERDA)
// =============================
function buscarLocales() {
  const texto = document.getElementById("txtBusqueda").value;
  const distancia = parseInt(document.getElementById("selDistancia").value, 10);

  const textoNorm = normalizarTexto(texto);

  // Filtrado por texto sobre nombre + tipodetalle + categoria + barrio
  let filtrados = todosLosLocales.filter(local => {
    if (!textoNorm) return true;
    const campo = normalizarTexto(
      (local.nombre || "") +
      " " +
      (local.tipodetalle || "") +
      " " +
      (local.categoria || "") +
      " " +
      (local.barrio || "")
    );
    return campo.includes(textoNorm);
  });

  // Si distancia = 0 -> toda Sevilla
  if (!distancia || isNaN(distancia) || distancia === 0) {
    if (filtrados.length === 0) {
      alert("No se han encontrado locales con esos criterios.");
      return;
    }
    pintarMapa(filtrados);
    // Ajustar vista al conjunto
    const group = L.featureGroup(
      filtrados
        .filter(l => l.lat && l.lng)
        .map(l => L.marker([l.lat, l.lng]))
    );
    if (group.getLayers().length > 0) {
      map.fitBounds(group.getBounds().pad(0.2));
    }
    return;
  }

  // Si hay distancia, intentamos usar geolocalización
  if (!navigator.geolocation) {
    alert("Tu navegador no permite geolocalización.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const latUser = pos.coords.latitude;
      const lngUser = pos.coords.longitude;

      filtrados = filtrados.filter(l => l.lat && l.lng);

      filtrados.forEach(l => {
        l._dist = map.distance([latUser, lngUser], [l.lat, l.lng]);
      });

      filtrados = filtrados.filter(l => l._dist <= distancia);

      if (filtrados.length === 0) {
        alert("No se han encontrado locales con esos criterios.");
        return;
      }

      filtrados.sort((a, b) => a._dist - b._dist);
      pintarMapa(filtrados);

      const primero = filtrados[0];
      map.setView([primero.lat, primero.lng], 15);
    },
    () => {
      alert("No se ha podido obtener tu ubicación.");
    }
  );
}

function resetMapa() {
  document.getElementById("txtBusqueda").value = "";
  document.getElementById("selDistancia").value = "0";
  pintarMapa(todosLosLocales);
  map.setView([37.3891, -5.9845], 13);
}

// =============================
// FILTRO AVANZADO (PANEL DERECHA)
// =============================
function aplicarFiltroMapa() {
  const cat = document.getElementById("fCategoria").value;
  const precioMin = parseInt(document.getElementById("fPrecioMin").value, 10) || null;
  const precioMax = parseInt(document.getElementById("fPrecioMax").value, 10) || null;
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

  // Ordenar por cercanía si hay geolocalización, pero sin dejar la lista vacía
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

        // recorte suave
        if (filtrados.length > 200) {
          filtrados = filtrados.slice(0, 200);
        }

        pintarMapa(filtrados);

        const primero = filtrados[0];
        if (primero && primero.lat && primero.lng) {
          map.setView([primero.lat, primero.lng], 15);
        }
      },
      () => {
        // Si falla geo, solo pintamos filtrados
        pintarMapa(filtrados);
      }
    );
  } else {
    pintarMapa(filtrados);
  }
}

// =============================
// EVENTOS INICIALES
// =============================
document.addEventListener("DOMContentLoaded", () => {
  initMapa();
  cargarLocales();

  // Botones búsqueda rápida
  document.getElementById("btnBuscar").addEventListener("click", buscarLocales);
  document.getElementById("btnReset").addEventListener("click", resetMapa);

  // Botón aplicar filtro avanzado
  const btnFiltro = document.getElementById("btnAplicarFiltro");
  if (btnFiltro) {
    btnFiltro.addEventListener("click", aplicarFiltroMapa);
  }
});
