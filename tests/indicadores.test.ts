import { describe, expect, it } from 'vitest';
import { asistenciaAgregada, asistenciaDeDiputado } from '../src/indicadores/asistencia';
import { contarDecretosPublicados, indicadoresAsuntosDiputado, resumenAsuntos, asuntosFiltrados, tiemposProcesales, mediana } from '../src/indicadores/asuntos';
import { seguimientoDe } from '../src/indicadores/exhortos';
import { asuntosUnicosTurnados, indicadoresComisiones } from '../src/indicadores/comisiones';
import { coberturaEvidencia } from '../src/indicadores/evidencia';
import { autoverificar } from '../src/indicadores/autoverificacion';
import { asunto, base, dip, prom, sesion } from './ayudas';

describe('asistencia', () => {
  const b = base({
    diputados: [dip('D1'), dip('D2', { distrito: '2', fecha_inicio: '2025-01-15' })],
    sesiones: [sesion('S1', '2025-01-07'), sesion('S2', '2025-01-14'), sesion('S3', '2025-01-21'), sesion('S4', '2025-01-28'), sesion('S5', '2025-02-04'), sesion('SP', '2025-02-05', { cuenta_para_asistencia: 'no' })],
    asistencias: [
      { id_sesion: 'S1', id_diputado: 'D1', estado: 'asistencia', id_fuente: 'EV-1' },
      { id_sesion: 'S2', id_diputado: 'D1', estado: 'ausencia', id_fuente: 'EV-1' },
      { id_sesion: 'S3', id_diputado: 'D1', estado: 'justificada', justificacion: 'Salud', id_fuente: 'EV-1' },
      { id_sesion: 'S4', id_diputado: 'D1', estado: 'pendiente' },
      // S5 sin registro para D1
      { id_sesion: 'SP', id_diputado: 'D1', estado: 'ausencia', id_fuente: 'EV-1' },
      { id_sesion: 'S3', id_diputado: 'D2', estado: 'asistencia', id_fuente: 'EV-1' },
    ],
  });

  it('excluye pendientes y sesiones sin registro del denominador y no las cuenta como ausencia', () => {
    const r = asistenciaDeDiputado(b, b.idx.diputado.get('D1')!, {});
    expect(r.sesionesElegibles).toBe(5); // SP no es elegible
    expect(r.denominador).toBe(3); // asistencia + ausencia + justificada
    expect(r.ausencias).toBe(1);
    expect(r.pendientes).toBe(1);
    expect(r.sinRegistro).toBe(1);
    expect(r.porcentaje).toBeCloseTo(33.33, 1);
    expect(r.definitivo).toBe(false);
  });

  it('solo considera las sesiones en que la persona ejercía el cargo', () => {
    const r = asistenciaDeDiputado(b, b.idx.diputado.get('D2')!, {});
    expect(r.sesionesElegibles).toBe(3); // S3, S4, S5
    expect(r.porcentaje).toBe(100);
  });

  it('agrega sumando numeradores y denominadores, no promediando porcentajes', () => {
    const r = asistenciaAgregada(b, b.diputados, {});
    expect(r.asistencias).toBe(2);
    expect(r.denominador).toBe(4);
    expect(r.porcentaje).toBe(50);
  });

  it('devuelve null cuando no hay registros evaluables', () => {
    const vacia = base({ diputados: [dip('D1')], sesiones: [sesion('S1', '2025-01-07')] });
    const r = asistenciaDeDiputado(vacia, vacia.diputados[0], {});
    expect(r.porcentaje).toBeNull();
    expect(r.sinRegistro).toBe(1);
  });

  it('respeta el filtro por año legislativo', () => {
    const r = asistenciaDeDiputado(b, b.idx.diputado.get('D1')!, { anio: 2 });
    expect(r.sesionesElegibles).toBe(0);
  });
});

describe('asuntos e iniciativas', () => {
  const b = base({
    diputados: [dip('D1'), dip('D2', { distrito: '2', id_partido: 'PB' })],
    asuntos: [
      asunto('I1', { estado_procesal: 'aprobado', fecha_aprobacion: '2025-03-01' }),
      asunto('I2', { estado_procesal: 'publicado', fecha_aprobacion: '2025-03-01', fecha_publicacion: '2025-03-20', numero_decreto_acuerdo: 'DEC-1' }),
      asunto('I3', { estado_procesal: 'turnado' }),
      asunto('D-I2', { tipo: 'dictamen', estado_procesal: 'publicado', fecha_aprobacion: '2025-03-01', fecha_publicacion: '2025-03-20', numero_decreto_acuerdo: 'DEC-1', id_asunto_origen: 'I2' }),
      asunto('X1', { tipo: 'exhorto', estado_procesal: 'aprobado', fecha_aprobacion: '2025-02-01' }),
      asunto('X2', { tipo: 'exhorto', estado_procesal: 'aprobado', fecha_aprobacion: '2025-02-01', estado_verificacion: 'pendiente' }),
    ],
    asunto_promoventes: [prom('I1', 'D1'), prom('I2', 'D1'), prom('I2', 'D2', 'coautor'), prom('I3', 'D2'), prom('I3', 'D1', 'adherente'), prom('X1', 'D1'), prom('X2', 'D1')],
  });

  it('distingue iniciativas individuales y compartidas', () => {
    const i = indicadoresAsuntosDiputado(b, b.idx.diputado.get('D1')!, {});
    expect(i.iniciativasAprobadas.total).toBe(2);
    expect(i.iniciativasAprobadas.individuales).toBe(1);
    expect(i.iniciativasAprobadas.compartidos).toBe(1);
  });

  it('no atribuye asuntos a adherentes', () => {
    const i = indicadoresAsuntosDiputado(b, b.idx.diputado.get('D1')!, {});
    expect(i.iniciativasPresentadas.asuntos.map((a) => a.id_asunto)).not.toContain('I3');
  });

  it('una iniciativa compartida cuenta una vez en el total general', () => {
    const r = resumenAsuntos(asuntosFiltrados(b, {}));
    expect(r.iniciativasPresentadas).toBe(3);
    expect(r.iniciativasAprobadas).toBe(2);
    const suma = b.diputados.reduce((s, d) => s + indicadoresAsuntosDiputado(b, d, {}).iniciativasPresentadas.total, 0);
    expect(suma).toBe(4); // I1, I2 (D1) + I2, I3 (D2)
  });

  it('cuenta exhortos aprobados verificados y separa los no verificados', () => {
    const i = indicadoresAsuntosDiputado(b, b.idx.diputado.get('D1')!, {});
    expect(i.exhortosAprobados.total).toBe(1);
    expect(i.exhortosAprobadosSinVerificar).toBe(1);
  });

  it('no duplica decretos con el mismo número', () => {
    expect(contarDecretosPublicados(b.asuntos)).toBe(1);
  });

  it('relaciona dictámenes con las iniciativas de origen', () => {
    const i = indicadoresAsuntosDiputado(b, b.idx.diputado.get('D2')!, {});
    expect(i.dictamenesRelacionados.map((a) => a.id_asunto)).toEqual(['D-I2']);
  });

  it('el filtro de partido incluye el asunto si algún promovente pertenece al partido', () => {
    expect(asuntosFiltrados(b, { partido: 'PB' }, ['iniciativa']).map((a) => a.id_asunto).sort()).toEqual(['I2', 'I3']);
  });

  it('calcula medianas de tiempo solo con fechas disponibles', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([])).toBeNull();
    const t = tiemposProcesales(b.asuntos.filter((a) => a.tipo === 'iniciativa'));
    expect(t.presentacionAprobacion.casos).toBe(2);
    expect(t.presentacionAprobacion.mediana).toBe(50);
  });
});

describe('seguimiento de exhortos', () => {
  const b = base({ asuntos: [asunto('X', { tipo: 'exhorto', estado_procesal: 'aprobado' }), asunto('Y', { tipo: 'exhorto', estado_procesal: 'turnado' })] });
  const x = b.idx.asunto.get('X')!;
  const e = (extra: Record<string, string>) => ({ id_exhorto: 'E', id_asunto: 'X', autoridad_destinataria: 'A', orden_gobierno: '', fecha_envio: '', id_fuente_envio: '', respuesta_localizada: '' as const, fecha_respuesta: '', id_fuente_respuesta: '', acciones_posteriores: '', id_fuente_acciones: '', verificacion_seguimiento: 'verificado' as const, notas: '', ...extra }) as never;

  it('nunca deriva incumplimiento y separa estados', () => {
    expect(seguimientoDe(b.idx.asunto.get('Y')!, undefined)).toBe('en_tramite');
    expect(seguimientoDe(x, undefined)).toBe('pendiente_seguimiento');
    expect(seguimientoDe(x, e({}))).toBe('pendiente_seguimiento');
    expect(seguimientoDe(x, e({ respuesta_localizada: 'no' }))).toBe('sin_respuesta_localizada');
    expect(seguimientoDe(x, e({ respuesta_localizada: 'si' }))).toBe('con_respuesta');
    expect(seguimientoDe(x, e({ respuesta_localizada: 'si', acciones_posteriores: 'Acción' }))).toBe('con_acciones');
    expect(seguimientoDe(x, e({ verificacion_seguimiento: 'no_verificado' }))).toBe('no_verificado');
  });
});

describe('comisiones', () => {
  it('no duplica asuntos turnados a varias comisiones en el total general', () => {
    const b = base({
      comisiones: [{ id_comision: 'C1', nombre: 'Uno' }, { id_comision: 'C2', nombre: 'Dos' }],
      asuntos: [asunto('A1'), asunto('A2')],
      asunto_comisiones: [
        { id_asunto: 'A1', id_comision: 'C1', rol: 'dictaminadora', fecha_turno: '2025-01-12', fecha_dictamen: '2025-02-11' },
        { id_asunto: 'A1', id_comision: 'C2', rol: 'coadyuvante', fecha_turno: '2025-01-12' },
        { id_asunto: 'A2', id_comision: 'C1', rol: 'dictaminadora', fecha_turno: '2025-01-12' },
      ],
    });
    const ind = indicadoresComisiones(b, {});
    expect(ind.find((i) => i.comision.id_comision === 'C1')!.turnados).toBe(2);
    expect(ind.reduce((s, i) => s + i.turnados, 0)).toBe(3);
    expect(asuntosUnicosTurnados(ind)).toBe(2);
    expect(ind[0].diasTurnoDictamen.mediana).toBe(30);
  });
});

describe('cobertura de evidencias y autoverificación', () => {
  it('cuenta solo los registros con fuente existente y URL', () => {
    const b = base({ diputados: [dip('D1'), dip('D2', { distrito: '2', id_fuente: '' }), dip('D3', { distrito: '3', id_fuente: 'NO-EXISTE' })] });
    const c = coberturaEvidencia(b);
    expect(c.total).toBe(3);
    expect(c.conEvidencia).toBe(1);
  });
  it('los cálculos son consistentes en un conjunto pequeño', () => {
    const b = base({ diputados: [dip('D1')], sesiones: [sesion('S1', '2025-01-07')], asistencias: [{ id_sesion: 'S1', id_diputado: 'D1', estado: 'asistencia', id_fuente: 'EV-1' }], asuntos: [asunto('I1')], asunto_promoventes: [prom('I1', 'D1')] });
    expect(autoverificar(b)).toEqual([]);
  });
});
