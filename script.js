// =============================
// UTILIDADES
// =============================
function normalizarTexto(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseHoraToMinutos(horaStr) {
  if (!horaStr) return null;
  const [h, m] = horaStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// horario: {lun:["09:00-14:00",...], ...}
function estaAbiertoAhora(local) {
  const horario = local.horario;
  if (!horario) return !!local.horario_abierto;

  const ahora = new Date();
  const diaSemana = ahora.getDay(); // 0=dom
  const diaClave = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"][diaSemana];
  const tramos = horario[diaClave];
  if (!Array.isArray(tramos) || tramos.length === 0) return false;

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  for (const tramo of tramos) {
    const [ini, fin] = (tramo || "").split("-");
    const mIni = parseHoraToMinutos(ini);
    const mFin = parseHoraToMinutos(fin);
    if (mIni == null || mFin == null) continue;

    if (mIni <= mFin) {
      if (minutosAhora >= mIni && minutosAhora <= mFin) return true;
    } else {
      if (minutosAhora >= mIni || minutosAhora <= mFin) return true;
    }
  }
  return false;
}

// =============================
// MAPA CENTRADO EN SEVILLA
// =============================
var map = L.map("map", {
  zoomControl: true,
  inertia: true,
  inertiaDeceleration: 3000,
  tap: true,
  preferCanvas: true
}).setView([37.3891, -5.9845], 14);

var boundsSevilla = L.latLngBounds(
  [37.30, -6.10],
  [37.50, -5.80]
);
map.setMaxBounds(boundsSevilla);
map.on("drag", function () {
  map.panInsideBounds(boundsSevilla, { animate: false });
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// MarkerCluster rendimiento
var clusterGroup = L.markerClusterGroup({
  spiderfyOnEveryZoom: false,
  disableClusteringAtZoom: 17,
  chunkedLoading: true,
  chunkDelay: 80,
  chunkInterval: 200,
  maxClusterRadius: 70,
  removeOutsideVisibleBounds: true
});
map.addLayer(clusterGroup);

// =============================
// ESTADO GLOBAL
// =============================
let todosLosLocales = [];
let localesFiltrados = [];
let barriosUnicos = new Set();
let tiposPorCategoria = {};
let primerPintado = true;
let puntoReferencia = null; // también se usa para distancia
let ubicacionUsuario = null;
let favoritos = new Set();
let ultimoDetalleLocal = null;

// Para sincronizar lista <-> markers
let markerPorId = {};
let localSeleccionadoId = null;
let markerSeleccionado = null;

// =============================
// ICONOS
// =============================
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
  Comida: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"),
  Cafetería: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png"),
  Alimentación: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png"),
  Moda: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png"),
  Belleza: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png"),
  Salud: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png"),
  Ocio: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png"),
  Deportes: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png"),
  Servicios: crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png"),
  Otros: crearIconoColor("https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png")
};

const iconoPorDefecto = iconosCategoria["Otros"];
const iconoSeleccionado = crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png");

// =============================
// GEOLOCALIZACIÓN
// =============================
let markerUbicacion = null;

function dibujarUbicacionUsuario(lat, lng) {
  ubicacionUsuario = { lat, lng };
  if (markerUbicacion) {
    markerUbicacion.setLatLng([lat, lng]);
  } else {
    markerUbicacion = L.marker([lat, lng], {
      title: "Estás aquí",
      icon: L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        shadowSize: [41, 41]
      })
    }).addTo(map).bindPopup("Estás aquí");
  }
}

function localizarUsuarioSimple() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      dibujarUbicacionUsuario(lat, lng);
    },
    err => {
      console.warn("No se pudo localizar usuario:", err);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60 * 1000
    }
  );
}

function buscarCercaDeMi() {
  if (!navigator.geolocation) {
    alert("Tu dispositivo no permite obtener la ubicación.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      dibujarUbicacionUsuario(lat, lng);
      puntoReferencia = { lat, lng };

      map.setView([lat, lng], 15);

      const radioSelect = document.getElementById("fRadioDistancia");
      if (radioSelect && !radioSelect.value) radioSelect.value = "1000";

      aplicarFiltros(true);
    },
    err => {
      console.warn("Error ubicación cerca de mí:", err);
      alert("No hemos podido obtener tu ubicación. Revisa permisos de ubicación del navegador.");
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}

function recentrarEnMi() {
  if (!ubicacionUsuario) {
    alert("Aún no tenemos tu ubicación.");
    return;
  }
  map.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 15);
}

// =============================
// GEOLOCALIZAR TEXTO
// =============================
function geocodificarDireccion(texto) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
    encodeURIComponent(texto) +
    "&limit=1";

  return fetch(url, { headers: { "Accept-Language": "es" } })
    .then(r => r.json())
    .then(res => {
      if (!Array.isArray(res) || res.length === 0) {
        throw new Error("No se ha encontrado esa ubicación");
      }
      const r0 = res[0];
      return {
        lat: parseFloat(r0.lat),
        lng: parseFloat(r0.lon)
      };
    });
}

// =============================
// FAVORITOS
// =============================
const CLAVE_FAVORITOS = "mapa_sevilla_favoritos";
const CLAVE_FILTROS = "mapa_sevilla_filtros";

function cargarFavoritosGuardados() {
  try {
    const txt = localStorage.getItem(CLAVE_FAVORITOS);
    if (!txt) return;
    const arr = JSON.parse(txt);
    if (Array.isArray(arr)) favoritos = new Set(arr);
  } catch (e) {
    console.warn("Error leyendo favoritos:", e);
  }
}

function guardarFavoritos() {
  try {
    localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify([...favoritos]));
  } catch (e) {
    console.warn("Error guardando favoritos:", e);
  }
}

function esFavorito(idLocal) {
  return favoritos.has(idLocal);
}

function toggleFavorito(idLocal) {
  if (favoritos.has(idLocal)) favoritos.delete(idLocal);
  else favoritos.add(idLocal);
  guardarFavoritos();
}

// =============================
// FILTROS -> localStorage
// =============================
function obtenerEstadoFiltros() {
  return {
    categoria: document.getElementById("fCategoria")?.value || "",
    tipo_detalle: document.getElementById("fTipoDetalle")?.value || "",
    precioMin: document.getElementById("fPrecioMin")?.value || "1",
    precioMax: document.getElementById("fPrecioMax")?.value || "3",
    barrio: document.getElementById("fBarrio")?.value || "",
    soloAbiertos: document.getElementById("fSoloAbiertos")?.checked || false,
    soloEnMapa: document.getElementById("fSoloEnMapa")?.checked || false,
    textoLibre: document.getElementById("fTextoLibre")?.value || "",
    ubicacionTexto: document.getElementById("fUbicacionCliente")?.value || "",
    radioDistancia: document.getElementById("fRadioDistancia")?.value || "",
    orden: document.getElementById("fOrden")?.value || "ninguno",
    valoracionMin: document.getElementById("fValoracionMin")?.value || "0"
  };
}

function aplicarEstadoFiltros(estado) {
  if (!estado) return;
  const setValue = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };

  setValue("fCategoria", estado.categoria || "");
  setValue("fTipoDetalle", estado.tipo_detalle || "");
  setValue("fPrecioMin", estado.precioMin || "1");
  setValue("fPrecioMax", estado.precioMax || "3");
  setValue("fBarrio", estado.barrio || "");
  setValue("fOrden", estado.orden || "ninguno");
  setValue("fValoracionMin", estado.valoracionMin || "0");

  const cbAbiertos = document.getElementById("fSoloAbiertos");
  if (cbAbiertos) cbAbiertos.checked = !!estado.soloAbiertos;

  const cbMapa = document.getElementById("fSoloEnMapa");
  if (cbMapa) cbMapa.checked = !!estado.soloEnMapa;

  setValue("fTextoLibre", estado.textoLibre || "");
  setValue("fUbicacionCliente", estado.ubicacionTexto || "");
  setValue("fRadioDistancia", estado.radioDistancia || "");
}

// =============================
// SELECTS
// =============================
function rellenarBarrios() {
  barriosUnicos.clear();
  todosLosLocales.forEach(l => {
    if (l.barrio) barriosUnicos.add(l.barrio);
  });

  const select = document.getElementById("fBarrio");
  if (!select) return;
  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todos los barrios";
  select.appendChild(optAll);

  Array.from(barriosUnicos)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach(barrio => {
      const opt = document.createElement("option");
      opt.value = barrio;
      opt.textContent = barrio;
      select.appendChild(opt);
    });
}

function construirTiposPorCategoria() {
  tiposPorCategoria = {};
  todosLosLocales.forEach(l => {
    const cat = l.categoria || "Otros";
    const tipo = l.tipo_detalle || "";
    if (!tiposPorCategoria[cat]) tiposPorCategoria[cat] = new Set();
    if (tipo) tiposPorCategoria[cat].add(tipo);
  });
}

function rellenarTiposDetalle() {
  const categoria = document.getElementById("fCategoria")?.value || "";
  const selectTipo = document.getElementById("fTipoDetalle");
  if (!selectTipo) return;
  selectTipo.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todos los tipos";
  selectTipo.appendChild(optAll);

  const setTipos = tiposPorCategoria[categoria] || new Set();
  Array.from(setTipos)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      selectTipo.appendChild(opt);
    });
}

// =============================
// CHIPS RESUMEN DE FILTROS
// =============================
function actualizarChipsResumen() {
  const cont = document.getElementById("chipsResumen");
  if (!cont) return;

  const estado = obtenerEstadoFiltros();
  const chips = [];

  if (estado.categoria) chips.push(estado.categoria);
  if (estado.tipo_detalle) chips.push(estado.tipo_detalle);
  if (estado.barrio) chips.push(estado.barrio);
  if (estado.soloAbiertos) chips.push("Abierto ahora");
  if (estado.soloEnMapa) chips.push("Solo en vista");
  if (estado.orden === "valoracion_desc") chips.push("Mejor valorados");
  if (estado.orden === "distancia_asc") chips.push("Más cerca primero");
  if (parseFloat(estado.valoracionMin || "0") > 0) chips.push(`≥ ${estado.valoracionMin}★`);
  if (estado.textoLibre) chips.push('Texto: "' + estado.textoLibre + '"');

  cont.innerHTML = "";

  if (chips.length === 0) {
    const span = document.createElement("span");
    span.className = "chip-filter";
    span.textContent = "Sin filtros activos";
    cont.appendChild(span);
    actualizarTextoBtnFiltros(0);
    return;
  }

  chips.forEach(txt => {
    const span = document.createElement("span");
    span.className = "chip-filter";
    span.textContent = txt;
    cont.appendChild(span);
  });

  actualizarTextoBtnFiltros(chips.length);
}

function actualizarTextoBtnFiltros(numFiltros) {
  const el = document.getElementById("textoBtnFiltros");
  if (!el) return;
  el.textContent = numFiltros > 0 ? `Filtros (${numFiltros})` : "Filtros";
}

// =============================
// LISTA LATERAL DE LOCALES
// =============================
function actualizarListaLocales(lista) {
  const maxLista = 300;
  localesFiltrados = (lista || []).slice(0, maxLista);

  const contenedor = document.getElementById("contenedorListaLocales");
  const contadorLista = document.getElementById("contadorLista");

  if (!contenedor || !contadorLista) return;

  contenedor.innerHTML = "";

  if (!localesFiltrados.length) {
    contenedor.innerHTML = '<div class="lista-empty">No se han encontrado locales con estos filtros.</div>';
    contadorLista.textContent = "0 locales";
    actualizarResumenLista("Sin resultados con los filtros actuales");
    return;
  }

  contadorLista.textContent = `${localesFiltrados.length} ${localesFiltrados.length === 1 ? "local" : "locales"}`;

  const fragment = document.createDocumentFragment();

  localesFiltrados.forEach(local => {
    const card = document.createElement("div");
    card.className = "card-local";
    card.dataset.id = local.id;

    const categoria = local.categoria || "Sin categoría";
    const tipo = local.tipo_detalle || "";

    const rawBarrio = (local.barrio || "").trim();
    const rawDireccion = (local.direccion || "").trim();

    const barrio = rawBarrio.toLowerCase() === "desconocido" ? "" : rawBarrio;

    let direccion = rawDireccion;
    if (!direccion || direccion.toLowerCase() === "dirección desconocida") {
      if (barrio) {
        direccion = `Barrio de ${barrio}`;
      } else if (local.lat && local.lng) {
        direccion = `${local.lat.toFixed(5)}, ${local.lng.toFixed(5)}`;
      } else {
        direccion = "Sevilla";
      }
    }
    const direccionTexto = direccion;

    const valoracion = (typeof local.valoracion === "number" && local.valoracion > 0)
      ? local.valoracion
      : null;
    const precio = local.precio || null;

    card.innerHTML = `
      <div class="card-local-titulo">
        <div class="card-local-nombre">${local.nombre || "Local sin nombre"}</div>
        ${valoracion !== null
          ? `<span class="pill-valoracion">★ ${valoracion.toFixed(1)}</span>`
          : ""}
      </div>
      <div class="card-local-etiquetas">
        ${categoria}${tipo ? " · " + tipo : ""}${precio ? " · " + "€".repeat(precio) : ""}
      </div>
      <div class="card-local-meta">
        <span class="pill-barrio">${barrio || "Sevilla"}</span>
        <span>${direccionTexto}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      seleccionarLocalDesdeLista(local.id);
    });

    fragment.appendChild(card);
  });

  contenedor.appendChild(fragment);

  resaltarCardSeleccionada();
}

function seleccionarLocalDesdeLista(idLocal) {
  localSeleccionadoId = idLocal;
  resaltarCardSeleccionada();

  const local = localesFiltrados.find(l => String(l.id) === String(idLocal));
  if (!local) return;

  if (local.lat && local.lng && typeof map !== "undefined") {
    map.setView([local.lat, local.lng], 18, { animate: true });
  }

  const marker = markerPorId[idLocal];
  if (marker) {
    resaltarMarkerSeleccionado(marker);
    if (marker.openPopup) {
      marker.openPopup();
    }
  }

  abrirPanelDetalle(local);

  const listaWrapper = document.getElementById("listaWrapper");
  if (listaWrapper && !listaWrapper.classList.contains("oculta")) {
    listaWrapper.classList.add("oculta");
    setTimeout(() => {
      map.invalidateSize();
    }, 220);
  }
}

function resaltarCardSeleccionada() {
  const cards = document.querySelectorAll(".card-local");
  cards.forEach(card => {
    if (card.dataset.id === String(localSeleccionadoId)) {
      card.classList.add("activo");
    } else {
      card.classList.remove("activo");
    }
  });
}

function actualizarResumenLista(texto) {
  const el = document.getElementById("textoResumenLista");
  if (!el) return;
  el.textContent = texto || "Mostrando todos los locales";
}

function resaltarMarkerSeleccionado(marker) {
  if (markerSeleccionado && markerSeleccionado !== marker) {
    const localPrevio = markerSeleccionado._localData;
    if (localPrevio) {
      const catPrev = localPrevio.categoria || "Otros";
      const iconPrev = iconosCategoria[catPrev] || iconoPorDefecto;
      markerSeleccionado.setIcon(iconPrev);
    }
  }

  markerSeleccionado = marker;

  if (!marker._localData) {
    const id = Object.keys(markerPorId).find(
      key => markerPorId[key] === marker
    );
    if (id) {
      const local = todosLosLocales.find(l => String(l.id) === String(id));
      if (local) marker._localData = local;
    }
  }

  marker.setIcon(iconoSeleccionado);

  const originalLatLng = marker.getLatLng();
  let step = 0;
  const maxStep = 10;
  const offset = 0.00015;

  const interval = setInterval(() => {
    step++;
    const factor = step <= maxStep / 2 ? 1 : -1;
    const delta = factor * offset;
    marker.setLatLng([originalLatLng.lat + delta, originalLatLng.lng]);
    if (step >= maxStep) {
      marker.setLatLng(originalLatLng);
      clearInterval(interval);
    }
  }, 25);
}

// =============================
// MARCADORES Y POPUP
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
  const urlMaps =
    "https://www.google.com/maps/search/?api=1&query=" +
    lat +
    "," +
    lng +
    "&query_place_id=" +
    query;

  const tieneValoracion = (typeof local.valoracion === "number" && local.valoracion > 0);
  const valoracionText = tieneValoracion
    ? "⭐ " + local.valoracion.toFixed(1) + "/5"
    : "Sin valoración";
  const recomendadoText = local.recomendado ? "Recomendado" : "";

  const popupHtml = `
    <b>${nombre}</b><br><br>
    ${valoracionText} ${recomendadoText ? " · " + recomendadoText : ""}<br><br>
    <a href="${urlMaps}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><br><br>
    <button class="btn-ver-detalle" data-id="${local.id}">Ver detalle</button><br>
  `;

  marker.bindPopup(popupHtml);

  markerPorId[local.id] = marker;
  marker._localData = local;

  return marker;
}

// =============================
// PANEL DETALLE
// =============================
function abrirPanelDetalle(local) {
  ultimoDetalleLocal = local;
  const panel = document.getElementById("panelDetalle");
  const titulo = document.getElementById("detalleNombre");
  const body = document.getElementById("panelDetalleBody");
  const btnFav = document.getElementById("btnFavorito");
  if (!panel || !titulo || !body || !btnFav) return;

  titulo.textContent = local.nombre || "Local";

  const precioText = local.precio ? "★".repeat(local.precio) : "Sin datos";
  const tieneValoracion = (typeof local.valoracion === "number" && local.valoracion > 0);
  const valoracionText = tieneValoracion
    ? "⭐ " + local.valoracion.toFixed(1) + "/5"
    : "Sin valoración";

  const abiertoAhora = estaAbiertoAhora(local);
  const desc = local.descripcion || "";
  const redes = local.redes || {};
  const foto = local.foto || "";

  const rawBarrio = (local.barrio || "").trim();
  const rawDireccion = (local.direccion || "").trim();

  const barrio = rawBarrio.toLowerCase() === "desconocido" ? "" : rawBarrio;

  let direccion = rawDireccion;
  if (!direccion || direccion.toLowerCase() === "dirección desconocida") {
    if (barrio) {
      direccion = `Barrio de ${barrio}`;
    } else if (local.lat && local.lng) {
      direccion = `${local.lat.toFixed(5)}, ${local.lng.toFixed(5)}`;
    } else {
      direccion = "Sevilla";
    }
  }
  const direccionTexto = direccion;

  body.innerHTML = `
    <div class="detalle-header">
      <div class="detalle-titulo-linea">
        <span class="detalle-nombre">${local.nombre || "Local"}</span>
        ${tieneValoracion
          ? `<span class="detalle-pill detalle-pill-valoracion">${valoracionText}</span>`
          : ""}
      </div>
      <div class="detalle-subtitulo">
        <span>${local.categoria || "-"}</span>
        ${local.tipo_detalle ? ` · <span>${local.tipo_detalle}</span>` : ""}
      </div>
    </div>

    <div class="detalle-info-principal">
      <p class="detalle-linea">
        <span class="detalle-label">Dirección</span>
        <span class="detalle-valor">${direccionTexto}</span>
      </p>
      <p class="detalle-linea">
        <span class="detalle-label">Barrio</span>
        <span class="detalle-valor">${barrio || "Sevilla"}</span>
      </p>
      <p class="detalle-linea">
        <span class="detalle-label">Precio</span>
        <span class="detalle-valor">${precioText}</span>
      </p>
      <p class="detalle-linea">
        <span class="detalle-label">Estado</span>
        <span class="detalle-valor ${abiertoAhora ? "estado-abierto" : "estado-cerrado"}">
          ${abiertoAhora ? "Abierto ahora" : "Cerrado ahora"}
        </span>
      </p>
    </div>

    ${desc ? `
      <div class="detalle-bloque">
        <p class="detalle-label">Descripción</p>
        <p class="detalle-descripcion">${desc}</p>
      </div>` : ""}

    ${(redes.web || redes.ig || redes.tiktok) ? `
      <div class="detalle-bloque detalle-redes">
        <p class="detalle-label">Presencia online</p>
        <div class="detalle-redes-links">
          ${redes.web ? `<a href="${redes.web}" target="_blank" rel="noopener noreferrer">Web</a>` : ""}
          ${redes.ig ? `<a href="${redes.ig}" target="_blank" rel="noopener noreferrer">Instagram</a>` : ""}
          ${redes.tiktok ? `<a href="${redes.tiktok}" target="_blank" rel="noopener noreferrer">TikTok</a>` : ""}
        </div>
      </div>` : ""}

    <div class="detalle-bloque">
      <a class="detalle-boton-maps"
         href="https://www.google.com/maps/search/?api=1&query=${local.lat},${local.lng}"
         target="_blank" rel="noopener noreferrer">
        Ver ruta en Google Maps
      </a>
    </div>

    ${foto ? `<div class="detalle-foto">
                <img src="${foto}"
                     alt="${local.nombre || "Foto del local"}"
                     loading="lazy"
                     onerror="this.style.display='none'">
              </div>` : ""}
  `;

  if (esFavorito(local.id)) {
    btnFav.classList.add("activo");
    btnFav.textContent = "♥";
  } else {
    btnFav.classList.remove("activo");
    btnFav.textContent = "♡";
  }

  panel.classList.add("abierto");
}

function cerrarPanelDetalle() {
  const panel = document.getElementById("panelDetalle");
  if (panel) panel.classList.remove("abierto");
  ultimoDetalleLocal = null;
}

// =============================
// PINTAR MAPA
// =============================
function pintarMapa(listaLocales, hacerFitBounds) {
  const cont = document.getElementById("contadorResultados");
  if (cont) {
    cont.textContent = !listaLocales || listaLocales.length === 0
      ? "No hay locales con los filtros actuales"
      : "Mostrando " + listaLocales.length + " locales";
  }

  clusterGroup.clearLayers();
  markerPorId = {};
  markerSeleccionado = null;

  const markers = [];
  listaLocales.forEach(local => {
    if (!local.lat || !local.lng) return;
    const marker = crearMarkerDesdeLocal(local);
    markers.push(marker);
  });

  clusterGroup.addLayers(markers);

  if (hacerFitBounds && markers.length > 0) {
    const group = L.featureGroup(markers);
    let bounds = group.getBounds();
    if (!boundsSevilla.contains(bounds)) bounds = boundsSevilla;
    map.fitBounds(bounds, { padding: [40, 40] });
 } else if (primerPintado && markers.length > 0) {
  primerPintado = false;
  // const group = L.featureGroup(markers);
  // let bounds = group.getBounds();
  // if (!boundsSevilla.contains(bounds)) bounds = boundsSevilla;
  // map.fitBounds(bounds, { padding: [40, 40] });
}

  clusterGroup.on("popupopen", function (e) {
    const popupNode = e.popup.getElement();
    if (!popupNode) return;
    const btn = popupNode.querySelector(".btn-ver-detalle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      const local = todosLosLocales.find(l => String(l.id) === String(id));
      if (local) {
        localSeleccionadoId = local.id;
        resaltarCardSeleccionada();
        const marker = markerPorId[local.id];
        if (marker) {
          resaltarMarkerSeleccionado(marker);
          if (local.lat && local.lng) {
            map.setView([local.lat, local.lng], 18, { animate: true });
          }
        }
        abrirPanelDetalle(local);
      }
    });
  });

  actualizarListaLocales(listaLocales);
  actualizarResumenLista();
}

// =============================
// APLICAR FILTROS
// =============================
function aplicarFiltros(hacerFitBounds) {
  const categoria = document.getElementById("fCategoria")?.value || "";
  const tipo_detalle = document.getElementById("fTipoDetalle")?.value || "";
  const precioMin = parseInt(document.getElementById("fPrecioMin")?.value || "1", 10);
  const precioMax = parseInt(document.getElementById("fPrecioMax")?.value || "3", 10);
  const barrio = document.getElementById("fBarrio")?.value || "";
  const soloAbiertos = document.getElementById("fSoloAbiertos")?.checked || false;
  const soloEnMapa = document.getElementById("fSoloEnMapa")?.checked || false;
  const textoLibre = normalizarTexto(document.getElementById("fTextoLibre")?.value || "");
  const radioMetros = parseInt(document.getElementById("fRadioDistancia")?.value || "", 10) || null;
  const orden = document.getElementById("fOrden")?.value || "ninguno";
  const valoracionMin = parseFloat(document.getElementById("fValoracionMin")?.value || "0");

  const bounds = soloEnMapa ? map.getBounds() : null;

  localesFiltrados = todosLosLocales.filter(local => {
    if (categoria && local.categoria !== categoria) return false;
    if (tipo_detalle && local.tipo_detalle !== tipo_detalle) return false;

    const p = local.precio ?? 2;
    if (p < precioMin || p > precioMax) return false;

    if (barrio && local.barrio !== barrio) return false;

    if (soloAbiertos && !estaAbiertoAhora(local)) return false;

    if (!Number.isNaN(valoracionMin) && valoracionMin > 0) {
      const v = typeof local.valoracion === "number" ? local.valoracion : 0;
      if (v < valoracionMin) return false;
    }

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

    if (soloEnMapa && bounds) {
      const latlng = L.latLng(local.lat, local.lng);
      if (!bounds.contains(latlng)) return false;
    }

    return true;
  });

  // ORDENACIÓN
  if (orden === "valoracion_desc") {
    localesFiltrados.sort((a, b) => (b.valoracion || 0) - (a.valoracion || 0));
  } else if (orden === "distancia_asc" && puntoReferencia) {
    const refLatLng = L.latLng(puntoReferencia.lat, puntoReferencia.lng);
    localesFiltrados.forEach(l => {
      if (l.lat && l.lng) {
        l._distancia = refLatLng.distanceTo(L.latLng(l.lat, l.lng));
      } else {
        l._distancia = Infinity;
      }
    });
    localesFiltrados.sort((a, b) => (a._distancia || Infinity) - (b._distancia || Infinity));
  }

  try {
    const estado = obtenerEstadoFiltros();
    localStorage.setItem(CLAVE_FILTROS, JSON.stringify(estado));
  } catch (e) {
    console.warn("No se pudieron guardar los filtros:", e);
  }

  actualizarChipsResumen();
  pintarMapa(localesFiltrados, hacerFitBounds);

  const resumenEl = document.getElementById("textoResumenLista");
  if (resumenEl) {
    if (soloEnMapa) {
      resumenEl.textContent = `Mostrando ${localesFiltrados.length} locales (filtrando por vista actual)`;
    } else if (orden === "distancia_asc" && puntoReferencia) {
      resumenEl.textContent = `Mostrando ${localesFiltrados.length} locales ordenados por distancia`;
    } else {
      resumenEl.textContent = `Mostrando ${localesFiltrados.length} locales`;
    }
  }
}

// =============================
// CARGA DE LOCALES
// =============================
function cargarLocales() {
  fetch("locales.json")
    .then(r => r.json())
    .then(locales => {
      if (!Array.isArray(locales)) {
        throw new Error("locales.json debe ser un array []");
      }

      todosLosLocales = locales.map((l, idx) => {
        if (l.id == null) l.id = idx + 1;
        if (!l.precio) l.precio = 2;
        if (typeof l.horario_abierto === "undefined") l.horario_abierto = true;
        if (!("foto" in l)) l.foto = "";
        if (!("redes" in l)) l.redes = {};
        if (!("barrio" in l)) l.barrio = "";
        if (!("direccion" in l)) l.direccion = "";
        return l;
      });

      rellenarBarrios();
      construirTiposPorCategoria();
      rellenarTiposDetalle();

      try {
        const txt = localStorage.getItem(CLAVE_FILTROS);
        if (txt) {
          const estado = JSON.parse(txt);
          aplicarEstadoFiltros(estado);
          rellenarTiposDetalle();
          if (estado.tipo_detalle) {
            const sel = document.getElementById("fTipoDetalle");
            if (sel) sel.value = estado.tipo_detalle;
          }
        }

        if (L.Browser.mobile) {
          const cbMapa = document.getElementById("fSoloEnMapa");
          if (cbMapa) cbMapa.checked = false;
        }
      } catch (e) {
        console.warn("No se pudieron leer filtros guardados:", e);
      }

      actualizarChipsResumen();
      aplicarFiltros(true);
    })
    .catch(e => {
      console.error("Error cargando locales:", e);
      alert("Error cargando locales. Mira la consola.");
    });
}

// =============================
// GESTOS SWIPE EN MÓVIL
// =============================
function habilitarSwipeCerrar(elemento, onCerrar) {
  if (!elemento) return;

  let touchStartY = null;
  let touchCurrentY = null;
  const desplazamientoMinimo = 60;

  elemento.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    touchStartY = e.touches[0].clientY;
    touchCurrentY = touchStartY;
  }, { passive: true });

  elemento.addEventListener("touchmove", function (e) {
    if (touchStartY === null) return;
    touchCurrentY = e.touches[0].clientY;
  }, { passive: true });

  elemento.addEventListener("touchend", function () {
    if (touchStartY === null || touchCurrentY === null) {
      touchStartY = null;
      touchCurrentY = null;
      return;
    }
    const diffY = touchCurrentY - touchStartY;
    if (diffY > desplazamientoMinimo) {
      onCerrar();
    }
    touchStartY = null;
    touchCurrentY = null;
  });
}

// =============================
// EVENTOS
// =============================
document.addEventListener("DOMContentLoaded", function () {
  const btnToggleBusqueda = document.getElementById("btnToggleBusqueda");
  const btnToggleFiltros = document.getElementById("btnToggleFiltros");
  const panelBusqueda = document.getElementById("panelBusqueda");
  const panelFiltros = document.getElementById("panelFiltros");
  const btnRecentraMi = document.getElementById("btnRecentraMi");
  const listaWrapper = document.getElementById("listaWrapper");
  const btnToggleLista = document.getElementById("btnToggleLista");

  if (btnToggleBusqueda && panelBusqueda) {
    btnToggleBusqueda.addEventListener("click", () => {
      panelBusqueda.style.display =
        panelBusqueda.style.display === "none" || panelBusqueda.style.display === ""
          ? "block" : "none";
    });
  }

  if (btnToggleFiltros && panelFiltros) {
    btnToggleFiltros.addEventListener("click", () => {
      panelFiltros.style.display =
        panelFiltros.style.display === "none" || panelFiltros.style.display === ""
          ? "block" : "none";
    });
  }

  const btnBuscarRapido = document.getElementById("btnBuscarRapido");
  if (btnBuscarRapido) {
    btnBuscarRapido.addEventListener("click", e => {
      e.preventDefault();
      const txtUbic = document.getElementById("fUbicacionCliente")?.value.trim();
      if (txtUbic) {
        geocodificarDireccion(txtUbic)
          .then(coords => {
            puntoReferencia = coords;
            map.setView([coords.lat, coords.lng], 15);
            aplicarFiltros(true);
          })
          .catch(err => {
            console.warn(err);
            alert("No hemos encontrado esa ubicación. Prueba con otra dirección o barrio.");
            puntoReferencia = null;
            aplicarFiltros(true);
          });
      } else {
        puntoReferencia = null;
        aplicarFiltros(true);
      }
    });
  }

  const btnCerca = document.getElementById("btnCercaDeMi");
  if (btnCerca) {
    btnCerca.addEventListener("click", e => {
      e.preventDefault();
      buscarCercaDeMi();
    });
  }

  const btnAplicar = document.getElementById("btnAplicarFiltros");
  if (btnAplicar) {
    btnAplicar.addEventListener("click", e => {
      e.preventDefault();
      aplicarFiltros(true);
    });
  }

  const btnQuitar = document.getElementById("btnQuitarFiltros");
  if (btnQuitar) {
    btnQuitar.addEventListener("click", e => {
      e.preventDefault();
      document.getElementById("fCategoria").value = "";
      document.getElementById("fTipoDetalle").value = "";
      document.getElementById("fPrecioMin").value = "1";
      document.getElementById("fPrecioMax").value = "3";
      const sb = document.getElementById("fBarrio");
      if (sb) sb.value = "";
      document.getElementById("fSoloAbiertos").checked = false;
      document.getElementById("fSoloEnMapa").checked = false;
      document.getElementById("fOrden").value = "ninguno";
      const vm = document.getElementById("fValoracionMin");
      if (vm) vm.value = "0";

      const tLibre = document.getElementById("fTextoLibre");
      if (tLibre) tLibre.value = "";
      const ubi = document.getElementById("fUbicacionCliente");
      if (ubi) ubi.value = "";
      const rd = document.getElementById("fRadioDistancia");
      if (rd) rd.value = "";

      puntoReferencia = null;

      try {
        localStorage.removeItem(CLAVE_FILTROS);
      } catch (e2) {
        console.warn("No se pudieron borrar filtros guardados:", e2);
      }

      localesFiltrados = todosLosLocales;
      actualizarChipsResumen();
      aplicarFiltros(true);
    });
  }

  const selCat = document.getElementById("fCategoria");
  if (selCat) {
    selCat.addEventListener("change", () => {
      rellenarTiposDetalle();
    });
  }

  const btnCerrarDetalle = document.getElementById("btnCerrarDetalle");
  if (btnCerrarDetalle) {
    btnCerrarDetalle.addEventListener("click", () => {
      cerrarPanelDetalle();
    });
  }

  const btnFavorito = document.getElementById("btnFavorito");
  if (btnFavorito) {
    btnFavorito.addEventListener("click", () => {
      if (!ultimoDetalleLocal) return;
      toggleFavorito(ultimoDetalleLocal.id);
      if (esFavorito(ultimoDetalleLocal.id)) {
        btnFavorito.classList.add("activo");
        btnFavorito.textContent = "♥";
      } else {
        btnFavorito.classList.remove("activo");
        btnFavorito.textContent = "♡";
      }
    });
  }

  map.on("moveend", () => {
    const centro = map.getCenter();
    const btnRecentraMiEl = btnRecentraMi;
    if (ubicacionUsuario && btnRecentraMiEl) {
      const d = map.distance(
        L.latLng(ubicacionUsuario.lat, ubicacionUsuario.lng),
        centro
      );
      btnRecentraMiEl.style.display = d > 800 ? "block" : "none";
    }
  });

  if (btnRecentraMi) {
    btnRecentraMi.addEventListener("click", e => {
      e.preventDefault();
      recentrarEnMi();
    });
  }

  if (btnToggleLista && listaWrapper) {
    btnToggleLista.addEventListener("click", () => {
      listaWrapper.classList.toggle("oculta");
      setTimeout(() => {
        map.invalidateSize();
      }, 220);
    });
  }

  // Swipe para cerrar lista y panel detalle en móvil
  habilitarSwipeCerrar(listaWrapper, () => {
    if (!listaWrapper.classList.contains("oculta")) {
      listaWrapper.classList.add("oculta");
      setTimeout(() => {
        map.invalidateSize();
      }, 220);
    }
  });

  const panelDetalleEl = document.getElementById("panelDetalle");
  habilitarSwipeCerrar(panelDetalleEl, () => {
    cerrarPanelDetalle();
  });

  cargarFavoritosGuardados();
  localizarUsuarioSimple();
  cargarLocales();
});

