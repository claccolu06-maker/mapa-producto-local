// script.js NUEVO

alert("¡Script INDITEX cargado!");

// 1. Crear mapa centrado en Sevilla
var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 2. Estado global
let todosLosLocales = [];
let localesFiltrados = [];
let grupoMarcadores = L.featureGroup().addTo(map);

console.log("Iniciando carga de locales...");

// 3. Cargar locales.json (nuevo formato)
fetch('locales.json')
  .then(r => {
    if (!r.ok) throw new Error("No se pudo cargar locales.json: " + r.statusText);
    return r.json();
  })
  .then(locales => {
    console.log("Array.isArray(locales):", Array.isArray(locales));
    console.log("Total locales:", locales.length);

    todosLosLocales = locales;

    // Preprocesar precio -> estrellas
    todosLosLocales.forEach(local => {
      if (typeof local.precio === "number") {
        local.precioStr = "★".repeat(local.precio);
      } else {
        local.precioStr = "";
      }
    });

    // Mostrar todos al inicio
    localesFiltrados = todosLosLocales;
    pintarMarcadores();
  })
  .catch(err => {
    console.error("Error cargando locales:", err);
  });

// 4. Función para pintar marcadores
function pintarMarcadores() {
  console.log("pintarMarcadores, nº locales:", localesFiltrados.length);

  grupoMarcadores.clearLayers();

  localesFiltrados.forEach(local => {
    console.log("Pintando local:", local.nombre, local.lat, local.lng);

    if (!local.lat || !local.lng) return;

    const marker = L.marker([local.lat, local.lng]);

    const popupHtml = `
      <b>${local.nombre || "Local sin nombre"}</b><br>
      ${local.direccion || "Dirección desconocida"}<br>
      Barrio: ${local.barrio || "Sin barrio"}<br>
      Categoría: ${local.categoria || "Sin categoría"}<br>
      Detalle: ${local.tipo_detalle || "Sin detalle"}<br>
      Precio: ${local.precioStr || "N/D"}<br>
      Abierto ahora: ${local.horario_abierto ? "Sí" : "No"}
    `;

    marker.bindPopup(popupHtml);
    grupoMarcadores.addLayer(marker);
  });

  if (grupoMarcadores.getLayers().length > 0) {
    map.fitBounds(grupoMarcadores.getBounds(), { padding: [40, 40] });
  } else {
    console.warn("No hay marcadores para mostrar (revisa lat/lng o filtros).");
  }
}
