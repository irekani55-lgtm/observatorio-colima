/**
 * Porcentaje de registros con evidencia verificable:
 *   registros cuyo id_fuente existe en "evidencias" y tiene una URL válida
 *   ÷ total de registros de las tablas principales × 100.
 * Se informa también por tabla para que el denominador sea transparente.
 */
import type { Base } from '../datos/modelo';
import type { NombreTabla } from '../datos/esquema';

const TABLAS_CON_FUENTE: { tabla: NombreTabla; titulo: string }[] = [
  { tabla: 'diputados', titulo: 'Diputaciones (25) y quienes ocuparon un lugar durante una licencia' },
  { tabla: 'sesiones', titulo: 'Sesiones' },
  { tabla: 'asistencias', titulo: 'Asistencias' },
  { tabla: 'asuntos', titulo: 'Asuntos legislativos' },
  { tabla: 'intervenciones', titulo: 'Intervenciones' },
  { tabla: 'votaciones', titulo: 'Votaciones' },
  { tabla: 'reuniones_comision', titulo: 'Reuniones de comisión' },
  { tabla: 'compromisos', titulo: 'Compromisos' },
  { tabla: 'agenda', titulo: 'Agenda pública' },
];

function urlValida(u: string) {
  return /^https?:\/\/\S+$/i.test(u);
}

export function coberturaEvidencia(b: Base) {
  const porTabla = TABLAS_CON_FUENTE.map(({ tabla, titulo }) => {
    const filas = b.crudas[tabla];
    let conEvidencia = 0;
    let oficial = 0;
    for (const f of filas) {
      const e = f.id_fuente ? b.idx.evidencia.get(f.id_fuente) : undefined;
      if (e && urlValida(e.url)) {
        conEvidencia++;
        if (e.oficial === 'si') oficial++;
      }
    }
    return { tabla, titulo, total: filas.length, conEvidencia, oficial };
  });
  const total = porTabla.reduce((s, x) => s + x.total, 0);
  const conEvidencia = porTabla.reduce((s, x) => s + x.conEvidencia, 0);
  return { porTabla, total, conEvidencia, porcentaje: total ? (conEvidencia / total) * 100 : null };
}
