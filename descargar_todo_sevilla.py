import requests
import json
import os
import time

overpass_url = "https://overpass-api.de/api/interpreter"

# Consulta agresiva: Busca TODO lo que sea tienda, bar o restaurante en el área de Sevilla
consulta = """
[out:json][timeout:90];
// Definir área de Sevilla (aprox) o buscar por relación si quisiéramos ser exactos
// Usamos bounding box rectangular para asegurar todo
(
  node["shop"](37.30,-6.05,37.45,-5.85);
  node["amenity"="restaurant"](37.30,-6.05,37.45,-5.85);
  node["amenity"="cafe"](37.30,-6.05,37.45,-5.85);
  node["amenity"="bar"](37.30,-6.05,37.45,-5.85);
);
out center;
"""

print("🚀 Lanzando aspiradora de datos sobre Sevilla...")
print("Esto puede tardar unos segundos porque son MUCHOS datos...")

try:
    resp = requests.get(overpass_url, params={"data": consulta})
    resp.raise_for_status()
    data = resp.json()
    
    elementos = data.get("elements", [])
    print(f"✅ ¡Recibidos {len(elementos)} locales brutos!")

    locales_procesados = []

    for elem in elementos:
        lat = elem.get("lat")
        lon = elem.get("lon")
        tags = elem.get("tags", {})
        
        # Ignorar si no tiene nombre (para limpiar basura)
        nombre = tags.get("name")
        if not nombre:
            continue

        # Intentar adivinar la categoría
        categoria = "Otros"
        tipo_tienda = tags.get("shop", "")
        tipo_amenity = tags.get("amenity", "")

        if tipo_amenity in ["bar", "cafe", "restaurant", "pub"]:
            categoria = "Hostelería"
        elif tipo_tienda in ["supermarket", "convenience", "greengrocer", "butcher", "bakery"]:
            categoria = "Alimentación"
        elif tipo_tienda in ["clothes", "shoes", "fashion"]:
            categoria = "Moda"
        elif tipo_tienda:
            categoria = "Comercio"

        locales_procesados.append({
            "nombre": nombre,
            "lat": lat,
            "lng": lon,
            "categoria": categoria,
            "tipo_detalle": tipo_tienda or tipo_amenity # Para saber qué es exactamente
        })

    # Guardar
    os.makedirs("data", exist_ok=True)
    ruta_salida = os.path.join("data", "locales.json")
    
    with open(ruta_salida, "w", encoding="utf-8") as f:
        json.dump(locales_procesados, f, ensure_ascii=False, indent=0) # indent=0 para que ocupe menos

    print(f"💾 Guardados {len(locales_procesados)} locales ÚTILES en {ruta_salida}")
    print("👉 Ahora tu JSON tiene miles de puntos. ¡Necesitas Clustering en el mapa!")

except Exception as e:
    print(f"❌ Error: {e}")
