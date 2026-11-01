/**
 * Parámetros de la Legislatura. Todo lo que aquí aparece debe poder
 * contrastarse con una fuente oficial; lo que no se ha confirmado lleva
 * `verificado: false` y la interfaz lo advierte.
 */

export const LEGISLATURA = {
  nombre: 'LXI Legislatura',
  congreso: 'H. Congreso del Estado de Colima',
  periodo: '2024–2027',
  /** Integración constitucional: 16 de mayoría relativa + 9 de representación proporcional. */
  integracion: { MR: 16, RP: 9, total: 25, verificado: true }, // directorio del Congreso e IEE Colima (consulta 29 oct 2026)
  distritos: 16,
};

export interface AnioLegislativo {
  numero: 1 | 2 | 3;
  etiqueta: string;
  inicio: string; // AAAA-MM-DD inclusive
  fin: string; // AAAA-MM-DD inclusive
}

/**
 * Límites de cada año legislativo. Se usan para clasificar asuntos e
 * intervenciones por fecha. Las sesiones llevan su año legislativo de forma
 * explícita en los datos, porque la numeración se reinicia cada año.
 *
 * Verificado con las sesiones solemnes de instalación registradas en la Gaceta
 * Parlamentaria (1 oct 2024, 1 oct 2025 y 1 oct 2026).
 */
export const ANIOS_LEGISLATIVOS: { verificado: boolean; anios: AnioLegislativo[] } = {
  verificado: true,
  anios: [
    { numero: 1, etiqueta: 'Primer año (2024–2025)', inicio: '2024-10-01', fin: '2025-09-30' },
    { numero: 2, etiqueta: 'Segundo año (2025–2026)', inicio: '2025-10-01', fin: '2026-09-30' },
    { numero: 3, etiqueta: 'Tercer año (2026–2027)', inicio: '2026-10-01', fin: '2027-09-30' },
  ],
};

export function anioLegislativoDeFecha(fecha: string | undefined): 1 | 2 | 3 | undefined {
  if (!fecha) return undefined;
  return ANIOS_LEGISLATIVOS.anios.find((a) => fecha >= a.inicio && fecha <= a.fin)?.numero;
}

export interface FuenteInstitucional {
  id: string;
  nombre: string;
  institucion: string;
  url: string;
  uso: string;
}

export const FUENTES_INSTITUCIONALES: FuenteInstitucional[] = [
  {
    id: 'congreso-diputados',
    nombre: 'Directorio de diputadas y diputados',
    institucion: 'H. Congreso del Estado de Colima',
    url: 'https://congresocol.gob.mx/web/www/diputados/index.php',
    uso: 'Integración de la Legislatura, fotografías oficiales, adscripción partidaria y tipo de representación.',
  },
  {
    id: 'congreso-gaceta',
    nombre: 'Gaceta Parlamentaria',
    institucion: 'H. Congreso del Estado de Colima',
    url: 'https://congresocol.gob.mx/web/www/gaceta/index.php',
    uso: 'Órdenes del día, iniciativas, dictámenes, actas, asistencias y votaciones.',
  },
  {
    id: 'congreso-comisiones',
    nombre: 'Comisiones legislativas',
    institucion: 'H. Congreso del Estado de Colima',
    url: 'https://congresocol.gob.mx/web/www/comisiones/index.php',
    uso: 'Integración de comisiones, reuniones y asuntos turnados.',
  },
  {
    id: 'congreso-transparencia',
    nombre: 'Portal de transparencia (obligaciones del Poder Legislativo)',
    institucion: 'H. Congreso del Estado de Colima',
    url: 'https://congresocol.gob.mx/web/www/transparencia/transparencia.php?art=&fra=&id=31',
    uso: 'Listas de asistencia, votaciones, diario de debates y dictámenes publicados por obligación de transparencia.',
  },
  {
    id: 'iee-distritos',
    nombre: 'Distritos electorales locales',
    institucion: 'Instituto Electoral del Estado de Colima',
    url: 'https://ieecolima.org.mx/distritos.html',
    uso: 'Cartografía y conformación de los 16 distritos electorales locales.',
  },
  {
    id: 'iee-distritos-locales',
    nombre: 'Distritos Electorales Locales (cartografía)',
    institucion: 'Instituto Electoral del Estado de Colima',
    url: 'https://ieecolima.org.mx/Distritos%20Electorales%20Locales.html',
    uso: 'Mapas por distrito electoral local.',
  },
  {
    id: 'iee-diputaciones-2024',
    nombre: 'Proceso Electoral 2023–2024: diputaciones',
    institucion: 'Instituto Electoral del Estado de Colima',
    url: 'https://ieecolima.org.mx/diputaciones2024.html',
    uso: 'Resultados y constancias de mayoría y de asignación de representación proporcional.',
  },
];

/**
 * Coaliciones con que se compitió en la elección local de 2024 (IEE Colima, integración de las diputaciones
 * 2024-2027: https://ieecolima.org.mx/diputaciones2024.html). Sirven para explicar el reparto del Congreso;
 * las curules se cuentan siempre por el partido de cada persona.
 */
export const COALICIONES_2024 = [
  { nombre: 'Sigamos Haciendo Historia en Colima', partidos: ['MORENA', 'PT', 'PVEM'] },
  { nombre: 'Fuerza y Corazón por Colima', partidos: ['PAN', 'PRI'] },
] as const;
