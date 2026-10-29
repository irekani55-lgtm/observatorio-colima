import { tablasVacias, type Fila, type NombreTabla } from '../src/datos/esquema';
import type { ConjuntoCargado } from '../src/datos/cargar';
import { construirBase } from '../src/datos/modelo';

const EV = 'EV-1';

/** Conjunto mínimo y explícito para pruebas; cada prueba agrega lo que necesita. */
export function conjunto(datos: Partial<Record<NombreTabla, Fila[]>> = {}): ConjuntoCargado {
  const tablas = tablasVacias();
  tablas.evidencias = [{ id_fuente: EV, tipo: 'acta', titulo: 'Acta', institucion: 'Congreso', url: 'https://example.org/a', fecha_documento: '2025-01-01', fecha_consulta: '2025-01-02', oficial: 'si' }];
  tablas.partidos = [{ id_partido: 'PA', nombre: 'Partido A', siglas: 'PA' }, { id_partido: 'PB', nombre: 'Partido B', siglas: 'PB' }];
  for (const [k, v] of Object.entries(datos)) tablas[k as NombreTabla] = v!;
  return { manifiesto: { id: 'prueba', nombre: 'Prueba', es_demo: true, fecha_corte: '2026-10-15', descripcion: '' }, tablas, archivosFaltantes: [], erroresLectura: [] };
}

export const base = (datos: Partial<Record<NombreTabla, Fila[]>> = {}) => construirBase(conjunto(datos));

export function dip(id: string, extra: Fila = {}): Fila {
  return { id_diputado: id, nombre_completo: `Persona ${id}`, id_partido: 'PA', tipo_representacion: 'MR', distrito: '1', calidad: 'propietario', fecha_inicio: '2024-10-01', fecha_fin: '', id_fuente: EV, estado_verificacion: 'verificado', ...extra };
}

export function sesion(id: string, fecha: string, extra: Fila = {}): Fila {
  return { id_sesion: id, fecha, anio_legislativo: '1', periodo: 'primer_ordinario', tipo_sesion: 'ordinaria', numero_sesion: '', cuenta_para_asistencia: 'si', id_fuente: EV, ...extra };
}

export function asunto(id: string, extra: Fila = {}): Fila {
  return { id_asunto: id, tipo: 'iniciativa', titulo: `Asunto ${id}`, fecha_presentacion: '2025-01-10', estado_procesal: 'presentado', id_fuente: EV, estado_verificacion: 'verificado', ...extra };
}

export const prom = (id_asunto: string, id_diputado: string, rol = 'autor'): Fila => ({ id_asunto, id_diputado, promovente_externo: '', rol });
