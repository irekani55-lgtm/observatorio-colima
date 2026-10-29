import { parsearCsv } from './csv';
import { NOMBRES_TABLAS, tablasVacias, type NombreTabla, type TablasCrudas } from './esquema';

export interface Manifiesto {
  id: string;
  nombre: string;
  /** true = datos ficticios para demostrar el funcionamiento. */
  es_demo: boolean;
  /** Fecha de corte de la información (AAAA-MM-DD). */
  fecha_corte: string;
  descripcion: string;
  responsable?: string;
}

export interface ConjuntoCargado {
  manifiesto: Manifiesto;
  tablas: TablasCrudas;
  /** Tablas cuyo archivo no existe o no se pudo leer (se tratan como vacías). */
  archivosFaltantes: NombreTabla[];
  erroresLectura: { tabla: NombreTabla; mensaje: string }[];
}

/** Lector abstracto: en el navegador usa fetch; en Node, el sistema de archivos. */
export type LectorTexto = (ruta: string) => Promise<string | null>;

export async function cargarConjunto(leer: LectorTexto, carpeta: string): Promise<ConjuntoCargado> {
  const textoManifiesto = await leer(`${carpeta}/manifiesto.json`);
  if (!textoManifiesto) throw new Error(`No se encontró ${carpeta}/manifiesto.json`);
  const manifiesto = JSON.parse(textoManifiesto) as Manifiesto;

  const tablas = tablasVacias();
  const archivosFaltantes: NombreTabla[] = [];
  const erroresLectura: ConjuntoCargado['erroresLectura'] = [];

  await Promise.all(
    NOMBRES_TABLAS.map(async (tabla) => {
      const texto = await leer(`${carpeta}/${tabla}.csv`);
      if (texto == null) {
        archivosFaltantes.push(tabla);
        return;
      }
      const { filas, errores } = parsearCsv(texto);
      tablas[tabla] = filas;
      for (const mensaje of errores) erroresLectura.push({ tabla, mensaje });
    }),
  );
  archivosFaltantes.sort();
  return { manifiesto, tablas, archivosFaltantes, erroresLectura };
}

export const lectorFetch =
  (base: string): LectorTexto =>
  async (ruta) => {
    try {
      const r = await fetch(`${base}${ruta}`, { cache: 'no-cache' });
      if (!r.ok) return null;
      const texto = await r.text();
      // Algunos servidores de desarrollo devuelven index.html para rutas inexistentes.
      if (/^\s*<!doctype html/i.test(texto)) return null;
      return texto;
    } catch {
      return null;
    }
  };

/** Determina qué conjunto de datos cargar: ?datos=<id> en la URL o config.json. */
export async function resolverConjunto(leer: LectorTexto, buscar = ''): Promise<string> {
  const param = new URLSearchParams(buscar).get('datos');
  if (param && /^[a-z0-9_-]+$/i.test(param)) return param;
  const cfg = await leer('config.json');
  if (cfg) {
    try {
      const id = (JSON.parse(cfg) as { conjunto?: string }).conjunto;
      if (id) return id;
    } catch {
      /* config inválido: se usa el valor por defecto */
    }
  }
  return 'demo';
}
