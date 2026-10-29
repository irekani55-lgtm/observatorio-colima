# Cartografía de distritos electorales locales

El mapa necesita **un archivo** que no se incluye en el proyecto porque debe provenir de la
fuente oficial:

```
public/geo/distritos_locales.geojson
```

## Requisitos

- 16 polígonos (`Polygon` o `MultiPolygon`), uno por distrito electoral local de Colima.
- Una propiedad con el número de distrito. Se reconocen `DISTRITO_L`, `DISTRITO_LOCAL`,
  `DISTRITO`, `distrito`, `DIST_LOC`, `NUM_DIST`, `ID_DISTRITO` (configurable en
  `src/config/mapa.ts`).
- Coordenadas WGS84 (EPSG:4326). También funcionan coordenadas proyectadas en metros.
- Debe corresponder a la **distritación aplicable al Proceso Electoral Local 2023–2024**, con la
  que se eligió la LXI Legislatura. El INE aprobó la demarcación local de Colima en el acuerdo
  INE/CG607/2016, y en enero de 2025 se trató una modificación de la cartografía en los
  municipios de Colima, Coquimatlán y Villa de Álvarez. Confirme qué versión corresponde antes
  de publicar.

## Dónde obtenerla

1. Instituto Electoral del Estado de Colima: https://ieecolima.org.mx/distritos.html y
   https://ieecolima.org.mx/Distritos%20Electorales%20Locales.html
2. Si el IEE solo ofrece mapas en PDF, solicite los archivos vectoriales (Shapefile o KML) al IEE
   o al INE (Dirección Ejecutiva del Registro Federal de Electores, cartografía electoral),
   incluso vía solicitud de acceso a la información.

**No** se deben dibujar límites aproximados ni digitalizarlos a mano a partir de una imagen.

## Conversión

```bash
npm run geo:convertir -- ruta/al/DISTRITO_LOCAL.shp
```

Esto genera `distritos_locales.geojson` y `estado_colima.geojson` (contorno estatal). Después:

1. Actualice `CONFIG_MAPA.fuente` en `src/config/mapa.ts` (institución, URL, distritación) y
   cambie `verificado` a `true`.
2. Abra la página **Mapa** y confirme que aparecen los 16 distritos sin advertencias.

Mientras el archivo no exista, el sitio muestra un **esquema no geográfico** (16 hexágonos)
rotulado como tal.
