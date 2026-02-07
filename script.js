console.log("script.js cargado");

var map = L.map('map').setView([37.3891, -5.9845], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Clusters por categoría (para poder filtrar)
var clAlim = L.markerClusterGroup({ chunkedLoading: true });
var clHost = L.markerClusterGroup({ chunkedLoading: true });
var clModa = L.markerClusterGroup({ chunkedLoading: true });
var clOtros = L.markerClusterGroup({ chunkedLoading: true });

fetch('data/locales.json')
  .then(r => {
    if (!r.ok) throw new Error("No puedo cargar data/locales.json");
    return r.json();
  })
  .then(locales => {
    console.log("Locales:", locales.length);

    locales.forEach(l => {
      if (l.lat == null || l.lng == null) return;

      const cat = l.categoria || "Otros";
      let group = clOtros;

      if (cat === "Alimentación") group = clAlim;
      else if (cat === "Hostelería") group = clHost;
      else if (cat === "Moda") group = clModa;

      const m = L.marker([l.lat, l.lng]).bindPopup(
        `<b>${l.nombre || "Sin nombre"}</b><br>${l.tipo_detalle || ""}`
      );

      group.addLayer(m);
    });

    map.addLayer(clAlim);
    map.addLayer(clHost);
    map.addLayer(clModa);
    map.addLayer(clOtros);

    L.control.layers(null, {
      "Alimentación": clAlim,
      "Hostelería": clHost,
      "Moda": clModa,
      "Otros": clOtros
    }, { collapsed: false }).addTo(map);
  })
  .catch(err => console.error(err));
