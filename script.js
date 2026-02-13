// script.js DEFINITIVO

alert("¡Script INDITEX cargado!");

var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let todosLosLocales = [];
let localesFiltrados = [];
let grupoMarcadores = L.featureGroup().addTo(map);

console.log("Iniciando carga de locales...");

fetch('locales.json')
  .then(r => {
    if (!r.ok) throw new Error("No se pudo cargar locales.json: " + r.statusText);
    return r.json();
  })
  .then(locales => {
    console.log("Array.isArray(locales):", Array.isArray(locales));
    console.log("Total locales:", locales.length);

    if (!Array.isArray(locales)) {
      throw new Error("locales.json no es un array");
    }

    // aquí locales YA es un array
    todosLosLocales = locales.map(local => ({
      ...local,
      precioStr: typeof local.precio === "number" ? "★".repeat(local.precio) : ""
    }));

    localesFiltrados = todosLosLocales;
    pintarMarcadores();
  })
  .catch(err => {
    console.error("Error cargando locales:", err);
  });

function pintarMarcadores() {
  console.log("pintarMarcadores, nº locales:", localesFiltrados.length);

  grupoMarcadores.clearLayers();

  localesFiltrados.forEach(local => {
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
    console.warn("No hay marcadores para mostrar.");
  }
}
