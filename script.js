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
var map = L.map('map').setView([37.3891, -5.9845], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

var clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// Marcar ubicación del usuario
function localizarUsuario() {
  if (!navigator.geolocation) {
    console.warn("Geolocalización no soportada");
    return;
  }

  console.log("Pidiendo ubicación...");
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
      console.warn("No se pudo obtener ubicación:", err);
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

// =============================
// ICONOS CON DIBUJOS POR CATEGORÍA
// =============================

// Comida: restaurante (cuchillo y tenedor)
const iconosCategoria = {
  "Comida": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png", // restaurante
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  }),
  "Alimentación": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3144/3144456.png", // carrito
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  }),
  "Moda": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/892/892458.png", // camiseta
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  }),
  "Belleza": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3461/3461869.png", // secador
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  }),
  "Salud": L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png", // pastilla
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  })
};

const iconoPorDefecto = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/252/252025.png",
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -20]
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
let puntoReferencia = null; // { lat, lng } elegido por el cliente

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

    // y recentramos en Sevilla para evitar irnos a América
    map.setView([37.3891, -5.9845], 13);
  }
}

// =============================
// RELLENAR SELECT DE BARRIOS
// (ahora todos son "Desconocido",
// pero esto ya queda listo para cuando los tengas reales)
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

    // Filtro por distancia desde puntoReferencia
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
        // de momento todos los barrios te vienen como "Desconocido"
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
  const btnAplicar = document.getElementById("btnAplicarFiltros");
  if (btnAplicar) {
    btnAplicar.addEventListener("click", function (e) {
      e.preventDefault();
      aplicarFiltros();
    });
  }

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
      localesFiltrados = todosLosLocales;
      pintarMapa(localesFiltrados);
    });
  }

   const btnBuscarRapido = document.getElementById("btnBuscarRapido");
  if (btnBuscarRapido) {
    btnBuscarRapido.addEventListener("click", function (e) {
      e.preventDefault();

      const textoUbicacion = document.getElementById("fUbicacionCliente")?.value.trim();

      if (textoUbicacion) {
        geocodificarDireccion(textoUbicacion)
          .then(coords => {
            console.log("Ubicación cliente:", coords);
            puntoReferencia = coords;          // guardamos el punto
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
        // sin ubicación escrita: no filtramos por distancia
        puntoReferencia = null;
        aplicarFiltros();
      }
    });
  }


// =============================
// GEOLOCALIZAR TEXTO (UBICACIÓN CLIENTE)
// =============================
function geocodificarDireccion(texto) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(texto) + "&limit=1";

  return fetch(url, {
    headers: {
      "Accept-Language": "es"
    }
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




