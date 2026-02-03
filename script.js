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
        ${textoOrigen}<br>
        <a href="${local.google_maps}" target="_blank">Abrir en Google Maps</a>
      `;

      const icono = local.origen_espanol ? iconoEspanol : iconoNormal;

      L.marker([local.lat, local.lng], { icon: icono })
        .addTo(map)
        .bindPopup(popupHtml);
    });
  })
  .catch(error => {
    console.error(error);
  });
