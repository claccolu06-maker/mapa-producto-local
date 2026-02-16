// =============================
// UTIL: NORMALIZAR TEXTO
// =============================
function normalizarTexto(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// =============================
// MAPA Y CLUSTERS
// =============================
var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

var clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// =============================
// BUSCAR CERCA DE MÍ
// =============================
function buscarCercaDeMi() {
  if (!navigator.geolocation) {
    alert("Tu dispositivo no permite obtener la ubicación.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      puntoReferencia = { lat, lng };

      // zoom a la posición del usuario
      map.setView([lat, lng], 15);

      // si no hay radio elegido, ponemos 1000 m por defecto
      const radioSelect = document.getElementById("fRadioDistancia");
      if (radioSelect && !radioSelect.value) {
        radioSelect.value = "1000";
      }

      aplicarFiltros();
    },
    function (err) {
      console.warn("Error ubicación para 'cerca de mí':", err);
      alert("No hemos podido obtener tu ubicación.");
    }
  );
}

// =============================
// ESTADO GLOBAL
// =============================
let todosLosLocales = [];
let localesFiltrados = [];
let barriosUnicos = new Set();
let primerPintado = true;
let puntoReferencia = null; // ubicación elegida por el cliente

// =============================
// ICONOS CON DIBUJOS POR CATEGORÍA
// =============================
// =============================
// ICONOS CON DIBUJOS POR CATEGORÍA (versión mejorada)
// =============================
const iconosCategoria = {
  // Comida: plato y cubiertos
  "Comida": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/1046/1046784.png",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
  }),

  // Alimentación / supermercado: bolsa de compra
  "Alimentación": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3144/3144459.png",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
  }),

  // Moda / ropa: camiseta
  "Moda": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/892/892458.png",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
  }),

  // Belleza / peluquería: cosméticos
  "Belleza": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3534/3534033.png",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
  }),

  // Salud: pastilla
  "Salud": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
  })
};

// Icono por defecto para otras categorías
const iconoPorDefecto = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/252/252025.png",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -24]
});


// =============================
// CREAR MARCADOR DESDE LOCAL
// =============================
function crearMarkerDesdeLocal(local) {
  const cat = local.categoria || "Otros";
  const icono = iconosCategoria[cat] || iconoPorDefecto;

  const marker = L.marker([local.lat, local.lng], {
    title: local.nombre || "",
    icon: icono
  });

  const popupHtml = `
    <b>${local.nombre || "Sin nombre"}</b><br>
    Categoría: ${local.categoria || "Sin categoría"}<br>
    Tipo: ${local.tipo_detalle || "-"}<br>
    Barrio: ${local.barrio || "-"}<br>
    Precio: ${local.precio ? "★".repeat(local.precio) : "Sin datos"}<br>
    Abierto ahora: ${local.horario_abierto ? "Sí" : "No"}<br>
    Dirección: ${local.direccion || "-"}
  `;

  marker.bindPopup(popupHtml);
  return marker;
}

// =============================
// PINTAR MAPA
// =============================
function pintarMapa(listaLocales) {
  console.log("pintarMapa, nº listaLocales:", listaLocales.length);

  clusterGroup.clearLayers();

  const markers = [];

  listaLocales.forEach(local => {
    if (!local.lat || !local.lng) {
      console.warn("Sin coords:", local.nombre);
      return;
    }
    const marker = crearMarkerDesdeLocal(local);
    markers.push(marker);
  });

  console.log("Marcadores que se van a añadir:", markers.length);
  clusterGroup.addLayers(markers);

  if (primerPintado && markers.length > 0) {
    primerPintado = false;

    const group = L.featureGroup(markers);
    const bounds = group.getBounds();
    map.fitBounds(bounds, { padding: [40, 40] });
    map.setView([37.3891, -5.9845], 13);
  }
}

// =============================
// RELLENAR SELECT DE BARRIOS
// =============================
function rellenarBarrios() {
  barriosUnicos.clear();
  todosLosLocales.forEach(l => {
    if (l.barrio) barriosUnicos.add(l.barrio);
  });

  const select = document.getElementById("fBarrio");
  if (!select) return;

  select.innerHTML = "";

  const optTodos = document.createElement("option");
  optTodos.value = "";
  optTodos.textContent = "Todos los barrios";
  select.appendChild(optTodos);

  Array.from(barriosUnicos)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach(barrio => {
      const opt = document.createElement("option");
      opt.value = barrio;
      opt.textContent = barrio;
      select.appendChild(opt);
    });
}

// =============================
// GEOLOCALIZAR TEXTO (UBICACIÓN CLIENTE)
// =============================
function geocodificarDireccion(texto) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
    encodeURIComponent(texto) +
    "&limit=1";

  return fetch(url, {
    headers: { "Accept-Language": "es" }
  })
    .then(r => r.json())
    .then(resultados => {
      if (!Array.isArray(resultados) || resultados.length === 0) {
        throw new Error("No se ha encontrado esa ubicación");
      }
      const r = resultados[0];
      return {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon)
      };
    });
}

// =============================
// APLICAR FILTROS
// =============================
function aplicarFiltros() {
  const categoria = document.getElementById("fCategoria")?.value || "";
  const precioMin = parseInt(document.getElementById("fPrecioMin")?.value || "1", 10);
  const precioMax = parseInt(document.getElementById("fPrecioMax")?.value || "3", 10);
  const barrio = document.getElementById("fBarrio")?.value || "";
  const soloAbiertos = document.getElementById("fSoloAbiertos")?.checked || false;
  const textoLibre = normalizarTexto(document.getElementById("fTextoLibre")?.value || "");
  const radioMetros = parseInt(document.getElementById("fRadioDistancia")?.value || "", 10) || null;

  localesFiltrados = todosLosLocales.filter(local => {
    if (categoria && local.categoria !== categoria) return false;

    const p = local.precio ?? 2;
    if (p < precioMin || p > precioMax) return false;

    if (barrio && local.barrio !== barrio) return false;

    if (soloAbiertos && !local.horario_abierto) return false;

    if (textoLibre) {
      const campo = normalizarTexto(
        (local.nombre || "") + " " +
        (local.categoria || "") + " " +
        (local.tipo_detalle || "") + " " +
        (local.barrio || "")
      );
      if (!campo.includes(textoLibre)) return false;
    }

    if (radioMetros && puntoReferencia) {
      if (!local.lat || !local.lng) return false;
      const d = map.distance(
        L.latLng(local.lat, local.lng),
        L.latLng(puntoReferencia.lat, puntoReferencia.lng)
      );
      if (d > radioMetros) return false;
    }

    return true;
  });

  pintarMapa(localesFiltrados);
}

// =============================
// CARGAR LOCALES
// =============================
function cargarLocales() {
  console.log("Cargando locales.json...");

  fetch('locales.json')
    .then(r => r.json())
    .then(locales => {
      if (!Array.isArray(locales)) {
        throw new Error("locales.json debe ser un array []");
      }

      todosLosLocales = locales.map(l => {
        if (!l.precio) l.precio = 2;
        if (typeof l.horario_abierto === "undefined") l.horario_abierto = true;
        return l;
      });

      console.log("Cargados", todosLosLocales.length, "locales.");
      localesFiltrados = todosLosLocales;

      rellenarBarrios();
      pintarMapa(localesFiltrados);
    })
    .catch(e => {
      console.error("Error cargando locales:", e);
      alert("Error cargando locales. Mira la consola.");
    });
}

// =============================
// EVENTOS
// =============================
document.addEventListener("DOMContentLoaded", function () {
  // Botón aplicar filtros
  const btnAplicar = document.getElementById("btnAplicarFiltros");
  if (btnAplicar) {
    btnAplicar.addEventListener("click", function (e) {
      e.preventDefault();
      aplicarFiltros();
    });
  }

  // Botón “Buscar cerca de mí”
  const btnCerca = document.getElementById("btnCercaDeMi");
  if (btnCerca) {
    btnCerca.addEventListener("click", function (e) {
      e.preventDefault();
      buscarCercaDeMi();
    });
  }

  // Botón reset
  const btnReset = document.getElementById("btnQuitarFiltros");
  if (btnReset) {
    btnReset.addEventListener("click", function (e) {
      e.preventDefault();
      document.getElementById("fCategoria").value = "";
      document.getElementById("fPrecioMin").value = "1";
      document.getElementById("fPrecioMax").value = "3";
      document.getElementById("fBarrio").value = "";
      document.getElementById("fSoloAbiertos").checked = false;
      document.getElementById("fTextoLibre").value = "";
      document.getElementById("fUbicacionCliente").value = "";
      document.getElementById("fRadioDistancia").value = "";
      puntoReferencia = null;
      localesFiltrados = todosLosLocales;
      pintarMapa(localesFiltrados);
    });
  }

  // Botón buscar rápido (texto + ubicación)
  const btnBuscarRapido = document.getElementById("btnBuscarRapido");
  if (btnBuscarRapido) {
    btnBuscarRapido.addEventListener("click", function (e) {
      e.preventDefault();

      const textoUbicacion = document.getElementById("fUbicacionCliente")?.value.trim();

      if (textoUbicacion) {
        geocodificarDireccion(textoUbicacion)
          .then(coords => {
            console.log("Ubicación cliente:", coords);
            puntoReferencia = coords;
            map.setView([coords.lat, coords.lng], 15);
            aplicarFiltros();
          })
          .catch(err => {
            console.warn(err);
            alert("No hemos encontrado esa ubicación. Prueba con otra dirección o barrio.");
            puntoReferencia = null;
            aplicarFiltros();
          });
      } else {
        puntoReferencia = null;
        aplicarFiltros();
      }
    });
  }

  // Lupa para abrir/cerrar panel de filtros
  const btnToggle = document.getElementById("btnToggleFiltros");
  const panelFiltros = document.getElementById("panelFiltros");
  if (btnToggle && panelFiltros) {
    btnToggle.addEventListener("click", function () {
      if (panelFiltros.style.display === "none" || panelFiltros.style.display === "") {
        panelFiltros.style.display = "block";
      } else {
        panelFiltros.style.display = "none";
      }
    });
  }

  // Inicialización
  // (si quieres puedes comentar localizarUsuario si ya usas mucho geolocalizador)
  // localizarUsuario();
  cargarLocales();
});


