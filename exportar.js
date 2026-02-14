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
