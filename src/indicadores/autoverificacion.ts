/**
 * Autoverificación de cálculos: recalcula los indicadores por caminos
 * independientes y reporta cualquier discrepancia como "error de cálculo".
 */
import type { Base } from '../datos/modelo';
import type { Problema } from '../datos/validar';
import { asistenciaAgregada, asistenciaDeDiputado } from './asistencia';
import { asuntosFiltrados, idsDiputadosPromoventes, indicadoresAsuntosDiputado, resumenAsuntos } from './asuntos';
import { fichasExhortos, resumenExhortos } from './exhortos';
import type { Filtro } from './filtro';

export function autoverificar(b: Base, f: Filtro = {}): Problema[] {
  const p: Problema[] = [];
  const err = (registro: string, mensaje: string) => p.push({ severidad: 'error', categoria: 'error_calculo', tabla: 'indicadores', registro, mensaje });

  let sumaDen = 0;
  let sumaAsis = 0;
  for (const d of b.diputados) {
    const r = asistenciaDeDiputado(b, d, f);
    const suma = r.asistencias + r.ausencias + r.justificadas + r.pendientes + r.noVerificadas + r.sinRegistro;
    if (suma !== r.sesionesElegibles) err(d.id_diputado, `Asistencia: la suma de estados (${suma}) no coincide con las sesiones elegibles (${r.sesionesElegibles}).`);
    if (r.porcentaje != null && (r.porcentaje < 0 || r.porcentaje > 100)) err(d.id_diputado, `Asistencia fuera de rango: ${r.porcentaje}.`);
    sumaDen += r.denominador;
    sumaAsis += r.asistencias;
  }
  const ag = asistenciaAgregada(b, b.diputados, f);
  if (ag.denominador !== sumaDen || ag.asistencias !== sumaAsis) err('Legislatura', 'Asistencia agregada distinta de la suma por persona.');

  const ini = asuntosFiltrados(b, f, ['iniciativa']);
  const res = resumenAsuntos(asuntosFiltrados(b, f));
  if (res.iniciativasPresentadas !== new Set(ini.map((a) => a.id_asunto)).size) err('Legislatura', 'Iniciativas presentadas: el total no coincide con el número de IDs únicos.');

  const atribuidas = new Set(ini.filter((a) => idsDiputadosPromoventes(a).length > 0).map((a) => a.id_asunto));
  let sumaPersonas = 0;
  for (const d of b.diputados) sumaPersonas += indicadoresAsuntosDiputado(b, d, f).iniciativasPresentadas.total;
  if (sumaPersonas < atribuidas.size) err('Legislatura', `La suma de iniciativas por persona (${sumaPersonas}) es menor que las iniciativas únicas atribuidas (${atribuidas.size}).`);

  const ex = resumenExhortos(fichasExhortos(b, f));
  if (!(ex.presentados >= ex.aprobados && ex.aprobados >= ex.enviados && ex.conRespuesta >= ex.conAcciones)) err('Exhortos', 'La secuencia presentados ≥ aprobados ≥ enviados no se cumple; revise estados y fechas de envío.');
  return p;
}
