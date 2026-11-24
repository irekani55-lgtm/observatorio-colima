# Observatorio Legislativo Colima | LXI Legislatura 2024–2027

Tablero ciudadano, público e interactivo para consultar y comparar la actividad legislativa
documentada de las diputadas y los diputados de la LXI Legislatura del H. Congreso del Estado
de Colima.

> **Estado actual:** la aplicación es funcional, pero se distribuye con un **conjunto de datos de
> demostración ficticio** (rotulado en todas las páginas) y con las **plantillas oficiales
> vacías**. La integración de la Legislatura, sus registros y la cartografía oficial deben
> capturarse desde las fuentes oficiales (ver «Pendientes»).

## Tecnología

| Pieza | Elección | Motivo |
|---|---|---|
| Interfaz | React 19 + TypeScript + Vite | Componentes reutilizables, tipado estricto, sitio estático sin servidor |
| Rutas | React Router (HashRouter) | Funciona en cualquier hosting estático (GitHub Pages, servidor institucional) |
| Gráficas | Recharts | Gráficas SVG accesibles, sin servicios externos |
| Mapa | d3-geo → SVG | Dibuja polígonos GeoJSON reales sin mapa base de terceros ni claves de API; cada distrito es un control accesible. Se descartaron Leaflet/MapLibre porque el mapa no necesita teselas ni zoom y añadirían dependencias y un servicio de teselas |
| Datos | CSV (PapaParse) + importador de Excel (ExcelJS, solo en desarrollo) | Edición con herramientas comunes; sin base de datos |
| Pruebas | Vitest + Testing Library | Pruebas de cálculos, validaciones e interfaz |

No hay servicios de pago ni dependencias en tiempo de ejecución fuera de las anteriores.

## Instalación y uso

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173
npm test             # pruebas
npm run build        # sitio estático en dist/
npm run preview      # sirve dist/ para revisarlo
```

El contenido de `dist/` se puede publicar en cualquier servidor web estático, en cualquier
subcarpeta.

## Estructura

```
public/
  datos/
    config.json            conjunto activo: {"conjunto": "demo" | "oficial"}
    demo/                  datos FICTICIOS (generados con npm run datos:demo)
    oficial/               plantillas vacías para los datos reales
  geo/LEEME.md             qué archivo de cartografía falta y cómo prepararlo
scripts/
  generar-demo.ts          genera el conjunto ficticio y las plantillas
  validar-datos.ts         valida un conjunto (sale con error si hay errores)
  excel-a-csv.ts           convierte un libro de Excel (una hoja por tabla) a CSV
  convertir-cartografia.mjs Shapefile/KML/GeoJSON → GeoJSON para el mapa
src/
  config/                  catálogos y etiquetas, parámetros de la Legislatura, mapa
  datos/                   esquema (diccionario), lectura CSV, modelo relacional, validación
  indicadores/             cálculos puros y verificables (asistencia, asuntos, exhortos…)
  componentes/             tarjetas, tablas, filtros, gráficas, ficha de diputación…
  mapa/                    geometría (d3-geo) y componente del mapa
  paginas/                 una página por sección
tests/                     pruebas unitarias, de interfaz y de los conjuntos incluidos
```

Datos originales (CSV), valores calculados (`src/indicadores`) y etiquetas de la interfaz
(`src/config/catalogos.ts`) están separados.

## Modelo de datos

Veinte tablas relacionadas por identificadores (el diccionario completo está en la página
**Metodología** y en `src/datos/esquema.ts`):

`evidencias`, `partidos`, `diputados`, `distritos`, `sesiones`, `asistencias`, `agenda`,
`asuntos`, `asunto_promoventes`, `asunto_comisiones`, `exhortos`, `intervenciones`,
`comisiones`, `comision_integrantes`, `reuniones_comision`, `asistencia_comision`,
`votaciones`, `votos`, `compromisos`, `compromiso_participantes`.

- Cada asunto aparece **una sola vez** en `asuntos`; promoventes y comisiones van en tablas de
  relación, de modo que un asunto con varios promoventes o turnado a varias comisiones no se
  duplica.
- Cada registro apunta a una evidencia (`id_fuente`) con URL, institución y fecha de consulta.
- Las sesiones tienen un ID único y guardan por separado año legislativo, periodo y número
  (la numeración se reinicia cada año).

## Actualizar los datos

1. Capture la información en `public/datos/oficial/*.csv`, o en un Excel con una hoja por tabla:
   ```bash
   npm run datos:excel -- captura.xlsx oficial
   ```
2. Valide:
   ```bash
   npm run datos:validar -- oficial
   ```
   Se detectan IDs duplicados, fechas inválidas, registros sin fuente, relaciones con IDs
   inexistentes, estados procesales incompatibles, posibles asuntos duplicados, datos
   incompletos y errores de cálculo. Nada se borra: todo se reporta (también en la página
   **Fuentes y datos**).
3. Escriba la fecha de corte en `public/datos/oficial/manifiesto.json` y active el conjunto en
   `public/datos/config.json`. Para probar sin activarlo, agregue `?datos=oficial` a la URL.

Las fotografías oficiales se enlazan por su URL de origen (`url_foto`) o se copian a `public/`
(`archivo_foto`). Si faltan o fallan, se muestra «Fotografía no disponible».

## Publicar en internet

El sitio es estático: lo que sale en `dist/` se puede subir a cualquier servicio de páginas web.

**GitHub Pages (automático).** El flujo `.github/workflows/publicar.yml` corre las pruebas, construye el sitio y lo
publica cada vez que se guardan cambios en `main`. Si una prueba falla, no se publica nada. Para activarlo, una sola vez:

1. El repositorio debe ser público (GitHub Pages es gratuito para repositorios públicos).
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Settings → Actions → General: permitir que corran los flujos de trabajo.

La dirección queda como `https://<usuario>.github.io/observatorio-colima/`.

**Dominio propio.** Después de comprarlo, en Settings → Pages → Custom domain escriba el dominio y siga las
instrucciones para agregar los registros DNS en el panel donde lo compró. Marque «Enforce HTTPS».
La imagen de vista previa al compartir (`public/compartir.png`) usa la dirección pública que da GitHub Pages
(variable `URL_SITIO`).

**Datos de contacto y repositorio.** Se escriben en `src/config/proyecto.ts`. Mientras estén vacíos, la página
«¿Quién hace el Observatorio?» no los muestra.

## Mapa

El mapa necesita `public/geo/distritos_locales.geojson` con los 16 distritos electorales
locales de la cartografía oficial del IEE Colima/INE. Instrucciones en `public/geo/LEEME.md`:

```bash
npm run geo:convertir -- DISTRITO_LOCAL.shp
```

Mientras falte, se muestra un **esquema no geográfico** de 16 hexágonos, rotulado como tal.
La selección por distrito, la ficha y la lista alternativa funcionan igual en ambos casos.

## Metodología (resumen)

- Asistencia = asistencias registradas ÷ sesiones elegibles con información verificable × 100.
  Pendientes, no verificados y sesiones sin registro se excluyen y **no** cuentan como ausencia;
  si existen, el porcentaje se marca como provisional.
- Iniciativas: se atribuyen a autores y coautores; se distinguen individuales y compartidas;
  en los totales generales cada asunto cuenta una vez.
- Exhortos: la aprobación se separa del seguimiento; nunca se deriva «incumplido».
- No hay índice único ni ranking de «mejor diputado».

## Pendientes (requieren acceso a las fuentes oficiales)

Desde el entorno de desarrollo no fue posible consultar `congresocol.gob.mx` ni
`ieecolima.org.mx` (bloqueados por la red del entorno). Por eso **no se cargaron datos reales**:

1. **Catálogo de diputaciones** (nombres, partido, MR/RP, distrito, suplencias, fotografías):
   desde el directorio del Congreso, contrastado con las constancias del IEE (Proceso Electoral
   2023–2024).
2. **Cartografía distrital oficial** (`distritos_locales.geojson`) y metadatos en
   `src/config/mapa.ts`. Confirmar qué distritación aplica (INE/CG607/2016 y su modificación
   tratada en enero de 2025).
3. **Límites de los años legislativos** en `src/config/legislatura.ts` (marcados como no
   verificados) y la integración 16 MR + 9 RP.
4. **Registros**: sesiones y listas de asistencia, asuntos de la Gaceta, Diario de los Debates,
   comisiones, votaciones, exhortos y su seguimiento, compromisos.
