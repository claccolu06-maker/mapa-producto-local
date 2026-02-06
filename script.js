console.log("Cargando mapa...");

// Crear el mapa centrado en Sevilla
var map = L.map('map').setView([37.3891, -5.9845], 13);

// Añadir capa de tiles de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Icono azul (normal)
var iconoNormal = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

// Icono verde (producto español)
var iconoEspanol = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});
// Icono por defecto (frutería)
var iconoFruteria = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Otros colores
var iconoPanaderia = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

var iconoCarniceria = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

var iconoOtros = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Icono verde para “producto español” (solo fruterías, si quieres mantenerlo)
var iconoEspanol = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});
// Cargar locales desde el JSON
fetch('data/locales.json')
  .then(response => {
    if (!response.ok) {
      throw new Error('Error al cargar locales.json');
    }
    return response.json();
  })
  .then(locales => {
    console.log("Locales cargados:", locales);

  locales.forEach(local => {
  const textoOrigen = local.origen_espanol
    ? '✔ Producto español'
    : '✖ Producto español no verificado';

  const popupHtml = `
    <strong>${local.nombre}</strong><br>
    ${local.direccion}<br>
    Categoría: ${local.categoria}<br>
    ${textoOrigen}<br>
    <a href="${local.google_maps}" target="_blank">Abrir en Google Maps</a>
  `;

  let icono;

  if (local.categoria === 'fruteria') {
    icono = local.origen_espanol ? iconoEspanol : iconoFruteria;
  } else if (local.categoria === 'panaderia') {
    icono = iconoPanaderia;
  } else if (local.categoria === 'carniceria') {
    icono = iconoCarniceria;
  } else {
    icono = iconoOtros;
  }

  L.marker([local.lat, local.lng], { icon: icono })
    .addTo(map)
    .bindPopup(popupHtml);
});
  })
  .catch(error => {
    console.error(error);
  });



