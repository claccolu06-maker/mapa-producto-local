// =============================
// MAPA COMERCIO LOCAL SEVILLA
// Versión 2.0 - Mejorado
// =============================

// =============================
// UTILIDADES
// =============================

/** Sanitizar HTML para prevenir XSS */
function escaparHTML(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function normalizarTexto(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseHoraToMinutos(horaStr) {
  if (!horaStr) return null;
  const partes = horaStr.split(":");
  if (partes.length < 2) return null;
  const [h, m] = partes.map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Comprueba si un local está abierto */
function estaAbiertoAhora(local, ahora) {
  const horario = local.horario;
  if (!horario) return !!local.horario_abierto;

  if (!ahora) ahora = new Date();
  const diaSemana = ahora.getDay();
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

/** Debounce para optimizar eventos frecuentes */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// =============================
// ESTADO GLOBAL CENTRALIZADO
// =============================
const App = {
  todosLosLocales: [],
  localesFiltrados: [],
  barriosUnicos: new Set(),
  tiposPorCategoria: {},
  primerPintado: true,
  puntoReferencia: null,
  ubicacionUsuario: null,
  favoritos: new Set(),
  ultimoDetalleLocal: null,
  markerPorId: {},
  localSeleccionadoId: null,
  markerSeleccionado: null,
  markerUbicacion: null,
  animacionActiva: null,
  eventosRegistrados: false,
  cargando: false,
};

// =============================
// CONSTANTES
// =============================
const CLAVE_FAVORITOS = "mapa_sevilla_favoritos";
const CLAVE_FILTROS = "mapa_sevilla_filtros";
const MAX_LISTA = 300;
const SEVILLA_CENTER = [37.3891, -5.9845];
const SEVILLA_ZOOM = 14;

// =============================
// INICIALIZACIÓN DEL MAPA
// =============================
const map = L.map("map", {
  zoomControl: true,
  inertia: true,
  inertiaDeceleration: 3000,
  tap: true,
  preferCanvas: true,
  maxZoom: 19,
  minZoom: 11,
}).setView(SEVILLA_CENTER, SEVILLA_ZOOM);

const boundsSevilla = L.latLngBounds(
  [37.28, -6.12],
  [37.52, -5.78]
);
map.setMaxBounds(boundsSevilla);

map.on("drag", function () {
  map.panInsideBounds(boundsSevilla, { animate: false });
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

map.zoomControl.setPosition('bottomright');

// MarkerCluster optimizado
const clusterGroup = L.markerClusterGroup({
  spiderfyOnEveryZoom: false,
  disableClusteringAtZoom: 17,
  chunkedLoading: true,
  chunkDelay: 50,
  chunkInterval: 150,
  maxClusterRadius: 60,
  removeOutsideVisibleBounds: true,
  animate: true,
  animateAddingMarkers: false,
  showCoverageOnHover: false,
});
map.addLayer(clusterGroup);

// =============================
// ICONOS POR CATEGORÍA
// =============================
function crearIconoColor(url) {
  return L.icon({
    iconUrl: url,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
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
  Otros: crearIconoColor("https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"),
};

const iconoPorDefecto = iconosCategoria["Otros"];
const iconoSeleccionado = crearIconoColor("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png");

const iconoUbicacionUsuario = L.divIcon({
  className: 'ubicacion-usuario-marker',
  html: '<div style="width:20px;height:20px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(59,130,246,0.5);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// =============================
// GEOLOCALIZACIÓN
// =============================
function dibujarUbicacionUsuario(lat, lng) {
  App.ubicacionUsuario = { lat, lng };
  
  if (App.markerUbicacion) {
    App.markerUbicacion.setLatLng([lat, lng]);
  } else {
    App.markerUbicacion = L.marker([lat, lng], {
      title: "Tu ubicación",
      icon: iconoUbicacionUsuario,
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup("<strong>📍 Estás aquí</strong>");
  }
}

function localizarUsuarioSimple() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      dibujarUbicacionUsuario(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn("No se pudo localizar usuario:", err.message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

function buscarCercaDeMi() {
  if (!navigator.geolocation) {
    mostrarNotificacion("Tu dispositivo no permite obtener la ubicación.", "error");
    return;
  }

  mostrarNotificacion("Obteniendo tu ubicación...", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      dibujarUbicacionUsuario(lat, lng);
      App.puntoReferencia = { lat, lng };
      map.setView([lat, lng], 15, { animate: true });

      const radioSelect = document.getElementById("fRadioDistancia");
      if (radioSelect && !radioSelect.value) radioSelect.value = "1000";

      aplicarFiltros(true);
      mostrarNotificacion("Mostrando locales cerca de ti", "success");
    },
    (err) => {
      console.warn("Error ubicación:", err);
      mostrarNotificacion("No pudimos obtener tu ubicación. Revisa los permisos.", "error");
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

function recentrarEnMi() {
  if (!App.ubicacionUsuario) {
    mostrarNotificacion("Aún no tenemos tu ubicación.", "info");
    return;
  }
  map.setView([App.ubicacionUsuario.lat, App.ubicacionUsuario.lng], 16, { animate: true });
}

// =============================
// NOTIFICACIONES
// =============================
function mostrarNotificacion(mensaje, tipo = "info") {
  let container = document.getElementById("notificaciones");
  if (!container) {
    container = document.createElement("div");
    container.id = "notificaciones";
    container.style.cssText = `
      position: fixed;
      top: 76px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const colores = {
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
    error: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  };

  const color = colores[tipo] || colores.info;

  const notif = document.createElement("div");
  notif.style.cssText = `
    background: ${color.bg};
    border: 1px solid ${color.border};
    color: ${color.text};
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    pointer-events: auto;
    animation: slideDown 0.3s ease-out;
  `;
  notif.textContent = mensaje;

  if (!document.getElementById("notif-styles")) {
    const style = document.createElement("style");
    style.id = "notif-styles";
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(notif);

  setTimeout(() => {
    notif.style.animation = "slideUp 0.3s ease-out forwards";
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// =============================
// GEOCODIFICAR DIRECCIÓN
// =============================
function geocodificarDireccion(texto) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
    encodeURIComponent(texto + ", Sevilla, España") +
    "&limit=1";

  return fetch(url, { headers: { "Accept-Language": "es" } })
    .then((r) => {
      if (!r.ok) throw new Error("Error en la búsqueda");
      return r.json();
    })
    .then((res) => {
      if (!Array.isArray(res) || res.length === 0) {
        throw new Error("No se ha encontrado esa ubicación");
      }
      return {
        lat: parseFloat(res[0].lat),
        lng: parseFloat(res[0].lon),
      };
    });
}

// =============================
// FAVORITOS
// =============================
function cargarFavoritosGuardados() {
  try {
    const txt = localStorage.getItem(CLAVE_FAVORITOS);
    if (!txt) return;
    const arr = JSON.parse(txt);
    if (Array.isArray(arr)) App.favoritos = new Set(arr);
  } catch (e) {
    console.warn("Error leyendo favoritos:", e);
  }
}

function guardarFavoritos() {
  try {
    localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify([...App.favoritos]));
  } catch (e) {
    console.warn("Error guardando favoritos:", e);
  }
}

function esFavorito(idLocal) {
  return App.favoritos.has(String(idLocal));
}

function toggleFavorito(idLocal) {
  const id = String(idLocal);
  if (App.favoritos.has(id)) {
    App.favoritos.delete(id);
  } else {
    App.favoritos.add(id);
  }
  guardarFavoritos();
}

// =============================
// FILTROS → localStorage
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
    valoracionMin: document.getElementById("fValoracionMin")?.value || "0",
  };
}

function aplicarEstadoFiltros(estado) {
  if (!estado) return;
  
  const setValue = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };

  setValue("fCategoria", estado.categoria);
  setValue("fTipoDetalle", estado.tipo_detalle);
  setValue("fPrecioMin", estado.precioMin || "1");
  setValue("fPrecioMax", estado.precioMax || "3");
  setValue("fBarrio", estado.barrio);
  setValue("fOrden", estado.orden || "ninguno");
  setValue("fValoracionMin", estado.valoracionMin || "0");
  setValue("fTextoLibre", estado.textoLibre);
  setValue("fUbicacionCliente", estado.ubicacionTexto);
  setValue("fRadioDistancia", estado.radioDistancia);

  const cbAbiertos = document.getElementById("fSoloAbiertos");
  if (cbAbiertos) cbAbiertos.checked = !!estado.soloAbiertos;

  const cbMapa = document.getElementById("fSoloEnMapa");
  if (cbMapa) cbMapa.checked = !!estado.soloEnMapa;
}

function guardarFiltros() {
  try {
    localStorage.setItem(CLAVE_FILTROS, JSON.stringify(obtenerEstadoFiltros()));
  } catch (e) {
    console.warn("No se pudieron guardar los filtros:", e);
  }
}

// =============================
// SELECTS DINÁMICOS
// =============================
function rellenarBarrios() {
  App.barriosUnicos.clear();
  App.todosLosLocales.forEach((l) => {
    if (l.barrio && l.barrio.toLowerCase() !== "desconocido") {
      App.barriosUnicos.add(l.barrio);
    }
  });

  const select = document.getElementById("fBarrio");
  if (!select) return;
  
  const valorActual = select.value;
  select.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todos los barrios";
  select.appendChild(optAll);

  Array.from(App.barriosUnicos)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach((barrio) => {
      const opt = document.createElement("option");
      opt.value = barrio;
      opt.textContent = barrio;
      select.appendChild(opt);
    });

  if (valorActual && App.barriosUnicos.has(valorActual)) {
    select.value = valorActual;
  }
}

function construirTiposPorCategoria() {
  App.tiposPorCategoria = {};
  App.todosLosLocales.forEach((l) => {
    const cat = l.categoria || "Otros";
    const tipo = l.tipo_detalle || "";
    if (!App.tiposPorCategoria[cat]) App.tiposPorCategoria[cat] = new Set();
    if (tipo) App.tiposPorCategoria[cat].add(tipo);
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

  if (!categoria) return;

  const setTipos = App.tiposPorCategoria[categoria] || new Set();
  Array.from(setTipos)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach((t) => {
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
  if (estado.soloAbiertos) chips.push("🟢 Abierto");
  if (estado.soloEnMapa) chips.push("🗺️ Vista actual");
  if (estado.orden === "valoracion_desc") chips.push("⭐ Mejor valorados");
  if (estado.orden === "distancia_asc") chips.push("📍 Más cercanos");
  if (parseFloat(estado.valoracionMin || "0") > 0) chips.push(`≥ ${estado.valoracionMin}★`);
  if (estado.textoLibre) chips.push(`"${estado.textoLibre}"`);

  cont.innerHTML = "";

  if (chips.length === 0) {
    const span = document.createElement("span");
    span.className = "chip-filter";
    span.textContent = "Sin filtros";
    cont.appendChild(span);
    actualizarTextoBtnFiltros(0);
    return;
  }

  chips.forEach((txt) => {
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
// HELPERS PARA DIRECCIÓN
// =============================
function obtenerDireccionTexto(local) {
  const rawBarrio = (local.barrio || "").trim();
  const rawDireccion = (local.direccion || "").trim();
  
  const barrio = rawBarrio.toLowerCase() === "desconocido" ? "" : rawBarrio;

  let direccion = rawDireccion;
  if (!direccion || direccion.toLowerCase() === "dirección desconocida") {
    if (barrio) {
      direccion = `${barrio}, Sevilla`;
    } else if (local.lat && local.lng) {
      direccion = `${local.lat.toFixed(4)}, ${local.lng.toFixed(4)}`;
    } else {
      direccion = "Sevilla";
    }
  }
  
  return { barrio, direccion };
}

// =============================
// LISTA LATERAL DE LOCALES
// =============================
function actualizarListaLocales(lista) {
  App.localesFiltrados = (lista || []).slice(0, MAX_LISTA);

  const contenedor = document.getElementById("contenedorListaLocales");
  const contadorLista = document.getElementById("contadorLista");

  if (!contenedor || !contadorLista) return;

  contenedor.innerHTML = "";

  if (!App.localesFiltrados.length) {
    contenedor.innerHTML = `
      <div class="lista-empty" role="status">
        <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
        <div>No se encontraron locales con estos filtros.</div>
        <div style="margin-top: 6px; font-size: 11px;">Prueba a ampliar los criterios de búsqueda.</div>
      </div>
    `;
    contadorLista.textContent = "0 locales";
    actualizarResumenLista("Sin resultados");
    return;
  }

  const total = App.localesFiltrados.length;
  contadorLista.textContent = `${total} ${total === 1 ? "local" : "locales"}`;

  const fragment = document.createDocumentFragment();

  App.localesFiltrados.forEach((local) => {
    const card = document.createElement("div");
    card.className = "card-local";
    card.dataset.id = local.id;
    card.setAttribute("role", "listitem");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${local.nombre || "Local"}, ${local.categoria || ""}`);

    const categoria = local.categoria || "Sin categoría";
    const tipo = local.tipo_detalle || "";
    const { barrio, direccion } = obtenerDireccionTexto(local);

    const valoracion =
      typeof local.valoracion === "number" && local.valoracion > 0
        ? local.valoracion
        : null;
    const precio = local.precio || null;

    card.innerHTML = `
      <div class="card-local-titulo">
        <div class="card-local-nombre">${escaparHTML(local.nombre || "Local sin nombre")}</div>
        ${valoracion !== null
          ? `<span class="pill-valoracion">★ ${valoracion.toFixed(1)}</span>`
          : ""}
      </div>
      <div class="card-local-etiquetas">
        ${escaparHTML(categoria)}${tipo ? " · " + escaparHTML(tipo) : ""}${precio ? " · " + "€".repeat(precio) : ""}
      </div>
      <div class="card-local-meta">
        <span class="pill-barrio">${escaparHTML(barrio || "Sevilla")}</span>
        <span>${escaparHTML(direccion)}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      seleccionarLocalDesdeLista(local.id);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        seleccionarLocalDesdeLista(local.id);
      }
    });

    fragment.appendChild(card);
  });

  contenedor.appendChild(fragment);
  resaltarCardSeleccionada();
}

function seleccionarLocalDesdeLista(idLocal) {
  App.localSeleccionadoId = idLocal;
  resaltarCardSeleccionada();

  const local = App.localesFiltrados.find((l) => String(l.id) === String(idLocal));
  if (!local) return;

  if (local.lat && local.lng) {
    map.setView([local.lat, local.lng], 17, { animate: true });
  }

  const marker = App.markerPorId[idLocal];
  if (marker) {
    resaltarMarkerSeleccionado(marker);
    setTimeout(() => {
      if (marker.openPopup) marker.openPopup();
    }, 300);
  }

  abrirPanelDetalle(local);

  // Ocultar lista en móvil
  if (window.innerWidth <= 1024) {
    const listaWrapper = document.getElementById("listaWrapper");
    const btnToggleLista = document.getElementById("btnToggleLista");
    if (listaWrapper && !listaWrapper.classList.contains("oculta")) {
      listaWrapper.classList.add("oculta");
      if (btnToggleLista) {
        btnToggleLista.classList.remove("lista-visible");
        btnToggleLista.setAttribute("aria-expanded", "false");
      }
      setTimeout(() => map.invalidateSize(), 250);
    }
  }
}

function resaltarCardSeleccionada() {
  const cards = document.querySelectorAll(".card-local");
  cards.forEach((card) => {
    const isActive = card.dataset.id === String(App.localSeleccionadoId);
    card.classList.toggle("activo", isActive);
    if (isActive) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

function actualizarResumenLista(texto) {
  const el = document.getElementById("textoResumenLista");
  if (!el) return;
  el.textContent = texto || "Mostrando todos los locales";
}

function resaltarMarkerSeleccionado(marker) {
  // Restaurar icono del marker previo
  if (App.markerSeleccionado && App.markerSeleccionado !== marker) {
    const localPrevio = App.markerSeleccionado._localData;
    if (localPrevio) {
      const catPrev = localPrevio.categoria || "Otros";
      App.markerSeleccionado.setIcon(iconosCategoria[catPrev] || iconoPorDefecto);
    }
  }

  App.markerSeleccionado = marker;

  if (!marker._localData) {
    const id = Object.keys(App.markerPorId).find(
      (key) => App.markerPorId[key] === marker
    );
    if (id) {
      const local = App.todosLosLocales.find((l) => String(l.id) === String(id));
      if (local) marker._localData = local;
    }
  }

  marker.setIcon(iconoSeleccionado);

  // Cancelar animación anterior
  if (App.animacionActiva) {
    clearInterval(App.animacionActiva);
    App.animacionActiva = null;
  }

  // Animación de rebote
  const originalLatLng = marker.getLatLng();
  let step = 0;
  const maxStep = 8;
  const offset = 0.00012;

  App.animacionActiva = setInterval(() => {
    step++;
    const factor = step <= maxStep / 2 ? 1 : -1;
    marker.setLatLng([originalLatLng.lat + factor * offset, originalLatLng.lng]);
    if (step >= maxStep) {
      marker.setLatLng(originalLatLng);
      clearInterval(App.animacionActiva);
      App.animacionActiva = null;
    }
  }, 30);
}

// =============================
// MARCADORES Y POPUP
// =============================
function crearMarkerDesdeLocal(local) {
  const cat = local.categoria || "Otros";
  const icono = iconosCategoria[cat] || iconoPorDefecto;

  const marker = L.marker([local.lat, local.lng], {
    title: local.nombre || "",
    icon: icono,
  });

  const nombre = escaparHTML(local.nombre || "Local sin nombre");
  const lat = local.lat;
  const lng = local.lng;
  const urlMaps = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const tieneValoracion = typeof local.valoracion === "number" && local.valoracion > 0;
  const valoracionText = tieneValoracion
    ? "⭐ " + local.valoracion.toFixed(1) + "/5"
    : "";

  const abiertoAhora = estaAbiertoAhora(local);
  const estadoText = abiertoAhora 
    ? '<span style="color:#059669;font-weight:600;">Abierto</span>' 
    : '<span style="color:#dc2626;font-weight:600;">Cerrado</span>';

  const popupHtml = `
    <div style="min-width:180px;">
      <strong style="font-size:14px;">${nombre}</strong><br>
      <span style="font-size:12px;color:#666;">${escaparHTML(local.categoria || "")}${local.tipo_detalle ? " · " + escaparHTML(local.tipo_detalle) : ""}</span><br>
      ${valoracionText ? `<span style="font-size:12px;">${valoracionText}</span><br>` : ""}
      <span style="font-size:12px;">${estadoText}</span><br>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        <a href="${escaparHTML(urlMaps)}" target="_blank" rel="noopener noreferrer" 
           style="font-size:11px;color:#2563eb;text-decoration:none;">📍 Google Maps</a>
        <button class="btn-ver-detalle" data-id="${escaparHTML(String(local.id))}">Ver detalle</button>
      </div>
    </div>
  `;

  marker.bindPopup(popupHtml, { maxWidth: 280 });

  App.markerPorId[local.id] = marker;
  marker._localData = local;

  return marker;
}

// =============================
// PANEL DETALLE
// =============================
function abrirPanelDetalle(local) {
  App.ultimoDetalleLocal = local;
  
  const panel = document.getElementById("panelDetalle");
  const titulo = document.getElementById("detalleNombre");
  const body = document.getElementById("panelDetalleBody");
  const btnFav = document.getElementById("btnFavorito");
  
  if (!panel || !titulo || !body || !btnFav) return;

  titulo.textContent = local.nombre || "Local";

  const precioText = local.precio ? "€".repeat(local.precio) : "Sin datos";
  const tieneValoracion = typeof local.valoracion === "number" && local.valoracion > 0;
  const valoracionText = tieneValoracion
    ? "⭐ " + local.valoracion.toFixed(1) + "/5"
    : "Sin valoración";

  const abiertoAhora = estaAbiertoAhora(local);
  const desc = local.descripcion || "";
  const redes = local.redes || {};
  const foto = local.foto || "";
  const { barrio, direccion } = obtenerDireccionTexto(local);

  body.innerHTML = `
    <div class="detalle-header">
      <div class="detalle-titulo-linea">
        <span class="detalle-nombre">${escaparHTML(local.nombre || "Local")}</span>
        ${tieneValoracion
          ? `<span class="detalle-pill detalle-pill-valoracion">${escaparHTML(valoracionText)}</span>`
          : ""}
      </div>
      <div class="detalle-subtitulo">
        <span>${escaparHTML(local.categoria || "-")}</span>
        ${local.tipo_detalle ? ` · <span>${escaparHTML(local.tipo_detalle)}</span>` : ""}
      </div>
    </div>

    <div class="detalle-info-principal">
      <p class="detalle-linea">
        <span class="detalle-label">📍 Dirección</span>
        <span class="detalle-valor">${escaparHTML(direccion)}</span>
      </p>
      <p class="detalle-linea">
        <span class="detalle-label">🏘️ Barrio</span>
        <span class="detalle-valor">${escaparHTML(barrio || "Sevilla")}</span>
      </p>
      <p class="detalle-linea">
        <span class="detalle-label">💰 Precio</span>
        <span class="detalle-valor">${escaparHTML(precioText)}</span>
      </p>
      <p class="detalle-linea">
        <span class="detalle-label">🕐 Estado</span>
        <span class="detalle-valor ${abiertoAhora ? "estado-abierto" : "estado-cerrado"}">
          ${abiertoAhora ? "Abierto ahora" : "Cerrado ahora"}
        </span>
      </p>
    </div>

    ${desc ? `
      <div class="detalle-bloque">
        <p class="detalle-label">📝 Descripción</p>
        <p class="detalle-descripcion">${escaparHTML(desc)}</p>
      </div>` : ""}

    ${(redes.web || redes.ig || redes.tiktok) ? `
      <div class="detalle-bloque">
        <p class="detalle-label">🌐 Redes sociales</p>
        <div class="detalle-redes-links">
          ${redes.web ? `<a href="${escaparHTML(redes.web)}" target="_blank" rel="noopener noreferrer">🌐 Web</a>` : ""}
          ${redes.ig ? `<a href="${escaparHTML(redes.ig)}" target="_blank" rel="noopener noreferrer">📷 Instagram</a>` : ""}
          ${redes.tiktok ? `<a href="${escaparHTML(redes.tiktok)}" target="_blank" rel="noopener noreferrer">🎵 TikTok</a>` : ""}
        </div>
      </div>` : ""}

    <div class="detalle-bloque">
      <a class="detalle-boton-maps"
         href="https://www.google.com/maps/search/?api=1&query=${local.lat},${local.lng}"
         target="_blank" rel="noopener noreferrer">
        🗺️ Abrir en Google Maps
      </a>
    </div>

    ${foto ? `<div class="detalle-foto">
                <img src="${escaparHTML(foto)}"
                     alt="Foto de ${escaparHTML(local.nombre || "local")}"
                     loading="lazy"
                     onerror="this.parentElement.style.display='none'">
              </div>` : ""}
  `;

  // Actualizar botón favorito
  actualizarBotonFavorito(btnFav, local.id);

  // Mostrar panel
  panel.classList.add("abierto");
  panel.setAttribute("aria-hidden", "false");

  // Mostrar overlay en móvil
  const overlay = document.getElementById("panelOverlay");
  if (overlay && window.innerWidth <= 768) {
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
  }

  // Focus para accesibilidad
  setTimeout(() => {
    const btnCerrar = document.getElementById("btnCerrarDetalle");
    if (btnCerrar) btnCerrar.focus();
  }, 300);
}

function actualizarBotonFavorito(btn, idLocal) {
  if (!btn) return;
  
  if (esFavorito(idLocal)) {
    btn.classList.add("activo");
    btn.textContent = "♥";
    btn.setAttribute("aria-label", "Quitar de favoritos");
    btn.title = "Quitar de favoritos";
  } else {
    btn.classList.remove("activo");
    btn.textContent = "♡";
    btn.setAttribute("aria-label", "Añadir a favoritos");
    btn.title = "Añadir a favoritos";
  }
}

function cerrarPanelDetalle() {
  const panel = document.getElementById("panelDetalle");
  const overlay = document.getElementById("panelOverlay");
  
  if (panel) {
    panel.classList.remove("abierto");
    panel.setAttribute("aria-hidden", "true");
  }
  
  if (overlay) {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
  }
  
  App.ultimoDetalleLocal = null;
}

// =============================
// PINTAR MAPA
// =============================
function pintarMapa(listaLocales, hacerFitBounds) {
  const cont = document.getElementById("contadorResultados");
  if (cont) {
    const num = listaLocales?.length || 0;
    cont.textContent = num === 0
      ? "No hay locales con los filtros actuales"
      : `Mostrando ${num} ${num === 1 ? "local" : "locales"}`;
  }

  clusterGroup.clearLayers();
  App.markerPorId = {};
  App.markerSeleccionado = null;

  const markers = [];
  (listaLocales || []).forEach((local) => {
    if (!local.lat || !local.lng) return;
    if (!boundsSevilla.contains(L.latLng(local.lat, local.lng))) return;
    markers.push(crearMarkerDesdeLocal(local));
  });

  if (markers.length > 0) {
    clusterGroup.addLayers(markers);
  }

  if (hacerFitBounds && markers.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
  } else if (App.primerPintado) {
    App.primerPintado = false;
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView(SEVILLA_CENTER, SEVILLA_ZOOM);
    }
  }

  actualizarListaLocales(listaLocales);
}

// =============================
// APLICAR FILTROS
// =============================
function aplicarFiltros(hacerFitBounds = false) {
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
  const ahora = new Date();

  App.localesFiltrados = App.todosLosLocales.filter((local) => {
    if (categoria && local.categoria !== categoria) return false;
    if (tipo_detalle && local.tipo_detalle !== tipo_detalle) return false;

    const p = local.precio ?? 2;
    if (p < precioMin || p > precioMax) return false;

    if (barrio && local.barrio !== barrio) return false;

    if (soloAbiertos && !estaAbiertoAhora(local, ahora)) return false;

    if (!Number.isNaN(valoracionMin) && valoracionMin > 0) {
      const v = typeof local.valoracion === "number" ? local.valoracion : 0;
      if (v < valoracionMin) return false;
    }

    if (textoLibre) {
      if (!local._busqueda || !local._busqueda.includes(textoLibre)) return false;
    }

    if (radioMetros && App.puntoReferencia) {
      if (!local.lat || !local.lng) return false;
      const d = map.distance(
        L.latLng(local.lat, local.lng),
        L.latLng(App.puntoReferencia.lat, App.puntoReferencia.lng)
      );
      if (d > radioMetros) return false;
    }

    if (soloEnMapa && bounds) {
      if (!local.lat || !local.lng) return false;
      if (!bounds.contains(L.latLng(local.lat, local.lng))) return false;
    }

    return true;
  });

  // Ordenar
  if (orden === "valoracion_desc") {
    App.localesFiltrados.sort((a, b) => (b.valoracion || 0) - (a.valoracion || 0));
  } else if (orden === "distancia_asc" && App.puntoReferencia) {
    const refLatLng = L.latLng(App.puntoReferencia.lat, App.puntoReferencia.lng);
    App.localesFiltrados.forEach((l) => {
      l._distancia = l.lat && l.lng
        ? refLatLng.distanceTo(L.latLng(l.lat, l.lng))
        : Infinity;
    });
    App.localesFiltrados.sort((a, b) => (a._distancia || Infinity) - (b._distancia || Infinity));
  }

  // Guardar filtros
  guardarFiltros();

  // Actualizar UI
  actualizarChipsResumen();
  pintarMapa(App.localesFiltrados, hacerFitBounds);

  // Actualizar resumen
  const resumenEl = document.getElementById("textoResumenLista");
  if (resumenEl) {
    const count = App.localesFiltrados.length;
    let texto = `Mostrando ${count} ${count === 1 ? "local" : "locales"}`;
    
    if (soloEnMapa) {
      texto += " en la vista actual";
    } else if (orden === "distancia_asc" && App.puntoReferencia) {
      texto += " por cercanía";
    } else if (orden === "valoracion_desc") {
      texto += " por valoración";
    }
    
    resumenEl.textContent = texto;
  }
}

// =============================
// CARGA DE LOCALES
// =============================
function cargarLocales() {
  App.cargando = true;
  
  const contenedor = document.getElementById("contenedorListaLocales");
  if (contenedor) {
    contenedor.innerHTML = `
      <div class="lista-empty loading" role="status">
        <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
        <div>Cargando locales...</div>
      </div>
    `;
  }

  fetch("locales.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((locales) => {
      if (!Array.isArray(locales)) {
        throw new Error("locales.json debe ser un array []");
      }

      App.todosLosLocales = locales.map((l, idx) => {
        l.id = String(l.id ?? idx + 1);
        l.lat = parseFloat(l.lat) || null;
        l.lng = parseFloat(l.lng) || null;

        if (!l.precio) l.precio = 2;
        if (typeof l.horario_abierto === "undefined") l.horario_abierto = true;
        if (!("foto" in l)) l.foto = "";
        if (!("redes" in l)) l.redes = {};
        if (!("barrio" in l)) l.barrio = "";
        if (!("direccion" in l)) l.direccion = "";

        // Pre-calcular campo de búsqueda normalizado
        l._busqueda = normalizarTexto(
          `${l.nombre || ""} ${l.categoria || ""} ${l.tipo_detalle || ""} ${l.barrio || ""} ${l.descripcion || ""}`
        );

        return l;
      });

      rellenarBarrios();
      construirTiposPorCategoria();
      rellenarTiposDetalle();

      // Restaurar filtros guardados
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

        // En móvil, desactivar "solo en mapa" por defecto
        if (L.Browser.mobile) {
          const cbMapa = document.getElementById("fSoloEnMapa");
          if (cbMapa) cbMapa.checked = false;
        }
      } catch (e) {
        console.warn("No se pudieron leer filtros guardados:", e);
      }

      App.cargando = false;
      actualizarChipsResumen();
      aplicarFiltros(true);

      mostrarNotificacion(`${App.todosLosLocales.length} locales cargados`, "success");
    })
    .catch((e) => {
      console.error("Error cargando locales:", e);
      App.cargando = false;
      
      const cont = document.getElementById("contadorResultados");
      if (cont) cont.textContent = "Error al cargar los datos";

      if (contenedor) {
        contenedor.innerHTML = `
          <div class="lista-empty" role="alert">
            <div style="font-size: 24px; margin-bottom: 8px;">❌</div>
            <div>Error al cargar los locales</div>
            <div style="margin-top: 6px; font-size: 11px;">${escaparHTML(e.message)}</div>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; border-radius: 999px; border: none; background: #2563eb; color: white; cursor: pointer;">Reintentar</button>
          </div>
        `;
      }

      mostrarNotificacion("Error al cargar los locales", "error");
    });
}

// =============================
// GESTOS SWIPE EN MÓVIL
// =============================
function habilitarSwipeCerrar(elemento, onCerrar) {
  if (!elemento) return;

  let touchStartY = null;
  let touchCurrentY = null;
  const desplazamientoMinimo = 80;

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
    if (touchCurrentY - touchStartY > desplazamientoMinimo) {
      onCerrar();
    }
    touchStartY = null;
    touchCurrentY = null;
  });
}

// =============================
// CERRAR PANELES
// =============================
function cerrarPanelBusqueda() {
  const panel = document.getElementById("panelBusqueda");
  const btn = document.getElementById("btnToggleBusqueda");
  const overlay = document.getElementById("panelOverlay");
  
  if (panel) panel.style.display = "none";
  if (btn) btn.setAttribute("aria-expanded", "false");
  if (overlay && window.innerWidth <= 768) {
    overlay.classList.remove("visible");
  }
}

function cerrarPanelFiltros() {
  const panel = document.getElementById("panelFiltros");
  const btn = document.getElementById("btnToggleFiltros");
  const overlay = document.getElementById("panelOverlay");
  
  if (panel) panel.style.display = "none";
  if (btn) btn.setAttribute("aria-expanded", "false");
  if (overlay && window.innerWidth <= 768) {
    overlay.classList.remove("visible");
  }
}

function cerrarTodosLosPaneles() {
  cerrarPanelBusqueda();
  cerrarPanelFiltros();
  cerrarPanelDetalle();
}

// =============================
// INICIALIZACIÓN DE EVENTOS
// =============================
function initEventos() {
  if (App.eventosRegistrados) return;
  App.eventosRegistrados = true;

  const btnToggleBusqueda = document.getElementById("btnToggleBusqueda");
  const btnToggleFiltros = document.getElementById("btnToggleFiltros");
  const panelBusqueda = document.getElementById("panelBusqueda");
  const panelFiltros = document.getElementById("panelFiltros");
  const btnRecentraMi = document.getElementById("btnRecentraMi");
  const listaWrapper = document.getElementById("listaWrapper");
  const btnToggleLista = document.getElementById("btnToggleLista");
  const panelOverlay = document.getElementById("panelOverlay");

  // --- Toggle panel de búsqueda ---
  if (btnToggleBusqueda && panelBusqueda) {
    btnToggleBusqueda.addEventListener("click", () => {
      const abierto = panelBusqueda.style.display === "block";
      
      if (abierto) {
        cerrarPanelBusqueda();
      } else {
        cerrarPanelFiltros();
        panelBusqueda.style.display = "block";
        btnToggleBusqueda.setAttribute("aria-expanded", "true");
        
        if (window.innerWidth <= 768 && panelOverlay) {
          panelOverlay.classList.add("visible");
        }
        
        // Focus en el primer input
        setTimeout(() => {
          const input = document.getElementById("fTextoLibre");
          if (input) input.focus();
        }, 100);
      }
    });
  }

  // --- Toggle panel de filtros ---
  if (btnToggleFiltros && panelFiltros) {
    btnToggleFiltros.addEventListener("click", () => {
      const abierto = panelFiltros.style.display === "block";
      
      if (abierto) {
        cerrarPanelFiltros();
      } else {
        cerrarPanelBusqueda();
        panelFiltros.style.display = "block";
        btnToggleFiltros.setAttribute("aria-expanded", "true");
        
        if (window.innerWidth <= 768 && panelOverlay) {
          panelOverlay.classList.add("visible");
        }
      }
    });
  }

  // --- Overlay ---
  if (panelOverlay) {
    panelOverlay.addEventListener("click", () => {
      cerrarTodosLosPaneles();
    });
  }

  // --- Búsqueda rápida ---
  const btnBuscarRapido = document.getElementById("btnBuscarRapido");
  if (btnBuscarRapido) {
    btnBuscarRapido.addEventListener("click", (e) => {
      e.preventDefault();
      const txtUbic = document.getElementById("fUbicacionCliente")?.value.trim();
      
      if (txtUbic) {
        mostrarNotificacion("Buscando ubicación...", "info");
        geocodificarDireccion(txtUbic)
          .then((coords) => {
            App.puntoReferencia = coords;
            map.setView([coords.lat, coords.lng], 15);
            aplicarFiltros(true);
            cerrarPanelBusqueda();
            mostrarNotificacion("Ubicación encontrada", "success");
          })
          .catch((err) => {
            console.warn(err);
            mostrarNotificacion("No encontramos esa ubicación", "error");
            App.puntoReferencia = null;
            aplicarFiltros(true);
          });
      } else {
        App.puntoReferencia = null;
        aplicarFiltros(true);
        cerrarPanelBusqueda();
      }
    });
  }

  // --- Cerca de mí ---
  const btnCerca = document.getElementById("btnCercaDeMi");
  if (btnCerca) {
    btnCerca.addEventListener("click", (e) => {
      e.preventDefault();
      buscarCercaDeMi();
      cerrarPanelBusqueda();
    });
  }

  // --- Aplicar filtros ---
  const btnAplicar = document.getElementById("btnAplicarFiltros");
  if (btnAplicar) {
    btnAplicar.addEventListener("click", (e) => {
      e.preventDefault();
      aplicarFiltros(true);
      cerrarPanelFiltros();
      mostrarNotificacion("Filtros aplicados", "success");
    });
  }

  // --- Quitar filtros ---
  const btnQuitar = document.getElementById("btnQuitarFiltros");
  if (btnQuitar) {
    btnQuitar.addEventListener("click", (e) => {
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

      App.puntoReferencia = null;

      rellenarTiposDetalle();

      try {
        localStorage.removeItem(CLAVE_FILTROS);
      } catch (e2) {
        console.warn("No se pudieron borrar filtros guardados:", e2);
      }

      App.localesFiltrados = App.todosLosLocales;
      actualizarChipsResumen();
      aplicarFiltros(true);
      
      mostrarNotificacion("Filtros eliminados", "info");
    });
  }

  // --- Cambio de categoría → actualizar tipos ---
  const selCat = document.getElementById("fCategoria");
  if (selCat) {
    selCat.addEventListener("change", () => {
      rellenarTiposDetalle();
    });
  }

  // --- Panel detalle ---
  const btnCerrarDetalle = document.getElementById("btnCerrarDetalle");
  if (btnCerrarDetalle) {
    btnCerrarDetalle.addEventListener("click", () => cerrarPanelDetalle());
  }

  // --- Cerrar con Escape ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarTodosLosPaneles();
    }
  });

  // --- Favorito ---
  const btnFavorito = document.getElementById("btnFavorito");
  if (btnFavorito) {
    btnFavorito.addEventListener("click", () => {
      if (!App.ultimoDetalleLocal) return;
      toggleFavorito(App.ultimoDetalleLocal.id);
      actualizarBotonFavorito(btnFavorito, App.ultimoDetalleLocal.id);
      
      const esFav = esFavorito(App.ultimoDetalleLocal.id);
      mostrarNotificacion(
        esFav ? "Añadido a favoritos ♥" : "Eliminado de favoritos",
        esFav ? "success" : "info"
      );
    });
  }

  // --- Recentrar en mí ---
  map.on("moveend", debounce(() => {
    if (App.ubicacionUsuario && btnRecentraMi) {
      const d = map.distance(
        L.latLng(App.ubicacionUsuario.lat, App.ubicacionUsuario.lng),
        map.getCenter()
      );
      btnRecentraMi.style.display = d > 500 ? "block" : "none";
    }
  }, 200));

  if (btnRecentraMi) {
    btnRecentraMi.addEventListener("click", (e) => {
      e.preventDefault();
      recentrarEnMi();
    });
  }

  // --- Toggle lista ---
  if (btnToggleLista && listaWrapper) {
    // Estado inicial: lista visible
    listaWrapper.classList.remove("oculta");
    btnToggleLista.classList.add("lista-visible");
    btnToggleLista.setAttribute("aria-expanded", "true");

    btnToggleLista.addEventListener("click", () => {
      const seOculta = !listaWrapper.classList.contains("oculta");
      listaWrapper.classList.toggle("oculta");
      btnToggleLista.classList.toggle("lista-visible", !seOculta);
      btnToggleLista.setAttribute("aria-expanded", !seOculta);
      setTimeout(() => map.invalidateSize(), 250);
    });
  }

  // --- Swipe para cerrar en móvil ---
  habilitarSwipeCerrar(listaWrapper, () => {
    if (!listaWrapper.classList.contains("oculta")) {
      listaWrapper.classList.add("oculta");
      if (btnToggleLista) {
        btnToggleLista.classList.remove("lista-visible");
        btnToggleLista.setAttribute("aria-expanded", "false");
      }
      setTimeout(() => map.invalidateSize(), 250);
    }
  });

  habilitarSwipeCerrar(document.getElementById("panelDetalle"), () => {
    cerrarPanelDetalle();
  });

  habilitarSwipeCerrar(panelBusqueda, () => {
    cerrarPanelBusqueda();
  });

  habilitarSwipeCerrar(panelFiltros, () => {
    cerrarPanelFiltros();
  });

  // --- Popup del cluster ---
  clusterGroup.on("popupopen", function (e) {
    const popupNode = e.popup.getElement();
    if (!popupNode) return;
    
    const btn = popupNode.querySelector(".btn-ver-detalle");
    if (!btn) return;
    
    // Evitar múltiples listeners
    if (btn.dataset.listenerAdded) return;
    btn.dataset.listenerAdded = "true";
    
    btn.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      const local = App.todosLosLocales.find((l) => String(l.id) === String(id));
      
      if (local) {
        App.localSeleccionadoId = local.id;
        resaltarCardSeleccionada();
        
        const marker = App.markerPorId[local.id];
        if (marker) {
          resaltarMarkerSeleccionado(marker);
        }
        
        abrirPanelDetalle(local);
        e.popup.close();
      }
    });
  });

  // --- Redimensionar mapa al cambiar tamaño de ventana ---
  window.addEventListener("resize", debounce(() => {
    map.invalidateSize();
  }, 200));
}

// =============================
// ARRANQUE
// =============================
document.addEventListener("DOMContentLoaded", function () {
  console.log("🗺️ Mapa Comercio Local Sevilla v2.0");
  
  cargarFavoritosGuardados();
  initEventos();
  localizarUsuarioSimple();
  cargarLocales();
});
