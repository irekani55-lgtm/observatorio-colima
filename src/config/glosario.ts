/**
 * Glosario en lenguaje ciudadano (Manual para el uso de un lenguaje ciudadano e incluyente del INE):
 * frases cortas, palabras sencillas y sin siglas sin explicar.
 */
export const GLOSARIO = {
  distrito: 'Zona del estado que elige a una diputación. Colima tiene 16. Un distrito no es lo mismo que un municipio.',
  seccion: 'Zona pequeña en que el INE divide el territorio para votar. Su número viene al frente de la credencial para votar.',
  iniciativa: 'Propuesta para crear una ley o cambiar una que ya existe.',
  dictamen: 'Opinión de una comisión sobre una propuesta. Después, todo el Congreso la vota.',
  comision: 'Grupo de diputadas y diputados que estudia un tema, como salud o agua, antes de que lo vote todo el Congreso.',
  exhorto: 'Petición del Congreso a otra autoridad para que atienda un problema. No la obliga.',
  punto_acuerdo: 'Propuesta para que el Congreso tome una postura o haga una petición; no cambia leyes.',
  pase_lista: 'La lista oficial anota quién estaba en el último pase de lista de cada sesión. Una persona puede llegar o salir antes, y aun así votar.',
  sesion: 'Reunión de todas las diputaciones para discutir y votar.',
  tribuna: 'Lugar desde donde se habla ante todo el Congreso.',
  mayoria_relativa: 'Diputación que ganó la elección en su distrito.',
  representacion_proporcional: 'Diputación por lista (también llamada plurinominal): el lugar se da a un partido según sus votos en todo el estado, y lo ocupa la siguiente persona de su lista. Representa a todo Colima, no a un distrito.',
  suplente: 'Persona que ocupa el lugar de la diputación titular de un distrito cuando esta pide permiso (licencia).',
  sustitucion: 'Las diputaciones por lista de partido no tienen suplente. Si una pide licencia, entra la siguiente persona de la lista de su partido (Código Electoral del Estado de Colima).',
  licencia: 'Permiso para dejar el cargo por un tiempo. Mientras dura, entra su suplente o, si llegó por lista, la siguiente persona de la lista.',
  votacion_dividida: 'Votación en la que al menos 3 diputaciones votaron a favor y al menos 3 en contra o se abstuvieron. Ahí se ve mejor la postura de cada persona, porque el Congreso no votó en bloque.',
} as const;

export type TerminoGlosario = keyof typeof GLOSARIO;
