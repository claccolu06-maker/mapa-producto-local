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
// ESTADO GLOBAL
// =============================
let todosLosLocales = [];
let localesFiltrados = [];
let barriosUnicos = new Set();
let primerPintado = true;
let puntoReferencia = null; // ubicación elegida por el cliente

// =============================
// ICONOS: PIN MISMO TIPO, COLOR POR CATEGORÍA
// =============================
// Usamos la familia de marcadores coloreados de Leaflet (pointhi)
function crearIconoColor(url) {
  return L.icon({
    iconUrl: url,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

const iconosCategoria = {
  "Comida": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"),
  "Cafetería": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png"),
  "Alimentación": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png"),
  "Moda": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png"),

  // Belleza: usamos azul claro
  "Belleza": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png"),

  // Salud: usamos amarillo
  "Salud": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png"),

  "Ocio": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png"),
  "Deportes": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png"),
  "Servicios": crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png"),
  "Otros": crearIconoColor("https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png") // azul estándar
};

const iconoPorDefecto = iconosCategoria["Otros"];


// =============================
// MARCAR SOLO TU UBICACIÓN (pin azul estándar)
// =============================
function localizarUsuario() {
  if (!navigator.geolocation) {
    console.warn("Geolocalización no soportada");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      console.log("Usuario localizado en:", lat, lng);

      const marker = L.marker([lat, lng], {
        title: "Estás aquí",
        icon: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          shadowSize: [41, 41]
        })
      }).addTo(map);
      marker.bindPopup("Estás aquí").openPopup();
    },
    function (err) {
      console.warn("No se pudo obtener ubicación (localizarUsuario):", err);
    }
  );
}

// =============================
// BUSCAR CERCA DE MÍ (usar tu ubicación como filtro)
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

      map.setView([lat, lng], 15);

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
// CREAR MARCADOR DESDE LOCAL
// =============================
function crearMarkerDesdeLocal(local) {
  const cat = local.categoria || "Otros";
  const icono = iconosCategoria[cat] || iconoPorDefecto;

  const marker = L.marker([local.lat, local.lng], {
    title: local.nombre || "",
    icon: icono
  });

  const nombre = local.nombre || "Local sin nombre";
  const lat = local.lat;
  const lng = local.lng;
  const query = encodeURIComponent(nombre + " Sevilla");
  const urlMaps = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${query}`;

  const popupHtml = `
    <b>${nombre}</b><br>
    Categoría: ${local.categoria || "Sin categoría"}<br>
    Tipo: ${local.tipo_detalle || "-"}<br>
    Barrio: ${local.barrio || "-"}<br>
    Precio: ${local.precio ? "★".repeat(local.precio) : "Sin datos"}<br>
    Abierto ahora: ${local.horario_abierto ? "Sí" : "No"}<br>
    Dirección: ${local.direccion || "-"}<br>
    <a href="${urlMaps}" target="_blank" rel="noopener noreferrer">
      Ver en Google Maps
    </a>
  `;

  marker.bindPopup(popupHtml);
  return marker;
}

// =============================
// PINTAR MAPA
// =============================
function pintarMapa(listaLocales) {
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
  localizarUsuario();
  cargarLocales();
});

