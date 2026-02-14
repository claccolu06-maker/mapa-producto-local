// =============================
// EXPORTAR LOCALES A JSON
// =============================

// Espera que en script.js exista una variable global
//   let todosLosLocales = [...];
// con objetos tipo:
//   { nombre, lat, lng, categoria, tipo_detalle, precio,
//     horario_abierto, barrio, direccion }

// Función principal para exportar todos los locales
function exportarLocalesJSON() {
  try {
    if (!window.todosLosLocales || !Array.isArray(window.todosLosLocales)) {
      alert("No hay locales cargados para exportar.");
      console.error("exportarLocalesJSON: todosLosLocales no es un array válido:", window.todosLosLocales);
      return;
    }

    const datos = window.todosLosLocales.map(local => ({
      nombre: local.nombre || "Sin nombre",
      lat: local.lat,
      lng: local.lng,
      categoria: local.categoria || "Otros",
      tipo_detalle: local.tipo_detalle || "",
      precio: local.precio ?? 2,
      horario_abierto: local.horario_abierto ?? true,
      barrio: local.barrio || "Desconocido",
      direccion: local.direccion || "Dirección desconocida"
    }));

    const blob = new Blob(
      [JSON.stringify(datos, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    const fecha = new Date().toISOString().slice(0, 10);
    enlace.download = "locales_export_" + fecha + ".json";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);

    console.log("Exportados", datos.length, "locales a JSON.");
  } catch (e) {
    console.error("Error exportando locales:", e);
    alert("Ha habido un error exportando los locales. Mira la consola para más detalles.");
  }
}

// Opcional: si quieres engancharlo a un botón con id="btnExportar"
document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("btnExportar");
  if (btn) {
    btn.addEventListener("click", exportarLocalesJSON);
  }
});
// Exportar puntos de localStorage a puntos.json
function exportarPuntos() {
  const puntosStr = localStorage.getItem("puntosLocalSeville");
  if (!puntosStr) {
    alert("No hay puntos guardados en el navegador.");
    return;
  }

  const puntos = JSON.parse(puntosStr);
  const blob = new Blob([JSON.stringify(puntos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "puntos.json";
  a.click();

  URL.revokeObjectURL(url);
}

// Añadir un botón para exportar
const boton = document.createElement("button");
boton.textContent = "Exportar puntos a JSON";
boton.style.marginTop = "10px";
boton.style.display = "block";
boton.style.width = "100%";
boton.style.padding = "8px";
boton.style.backgroundColor = "#007bff";
boton.style.color = "white";
boton.style.border = "none";
boton.style.borderRadius = "4px";
boton.style.cursor = "pointer";
boton.addEventListener("click", exportarPuntos);

const contenedor = document.querySelector(".container");
contenedor.appendChild(boton);

