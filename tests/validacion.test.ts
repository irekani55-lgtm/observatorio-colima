import { describe, expect, it } from 'vitest';
import { esFechaValida, normalizarTitulo, validarTodo } from '../src/datos/validar';
import { parsearCsv } from '../src/datos/csv';
import { asunto, base, dip, prom, sesion } from './ayudas';

const categorias = (b: ReturnType<typeof base>) => validarTodo(b).map((p) => p.categoria);

describe('validación', () => {
  it('reconoce fechas válidas e inválidas', () => {
    expect(esFechaValida('2025-02-28')).toBe(true);
    expect(esFechaValida('2024-02-29')).toBe(true);
    expect(esFechaValida('2025-02-30')).toBe(false);
    expect(esFechaValida('30/01/2025')).toBe(false);
  });

  it('detecta IDs duplicados sin eliminar registros', () => {
    const b = base({ diputados: [dip('D1'), dip('D1', { distrito: '2' })] });
    expect(categorias(b)).toContain('id_duplicado');
    expect(b.diputados).toHaveLength(2);
  });

  it('detecta relaciones con IDs inexistentes', () => {
    const b = base({ asuntos: [asunto('A1')], asunto_promoventes: [prom('A1', 'NO-EXISTE')] });
    expect(validarTodo(b).some((p) => p.categoria === 'relacion_inexistente' && p.columna === 'id_diputado')).toBe(true);
  });

  it('detecta registros sin fuente', () => {
    const b = base({ diputados: [dip('D1', { id_fuente: '' })] });
    expect(categorias(b)).toContain('sin_fuente');
  });

  it('no exige fuente a un registro de asistencia pendiente', () => {
    const b = base({ diputados: [dip('D1')], sesiones: [sesion('S1', '2025-01-07')], asistencias: [{ id_sesion: 'S1', id_diputado: 'D1', estado: 'pendiente' }] });
    expect(categorias(b)).not.toContain('sin_fuente');
  });

  it('detecta estados incompatibles con el tipo de asunto', () => {
    const b = base({ asuntos: [asunto('X1', { tipo: 'exhorto', estado_procesal: 'publicado' })], asunto_promoventes: [prom('X1', 'D1')], diputados: [dip('D1')] });
    expect(categorias(b)).toContain('estado_incompatible');
  });

  it('detecta fechas fuera de orden', () => {
    const b = base({ asuntos: [asunto('A1', { estado_procesal: 'aprobado', fecha_aprobacion: '2024-12-01' })] });
    expect(validarTodo(b).some((p) => p.categoria === 'fecha_invalida' && p.columna === 'fecha_aprobacion')).toBe(true);
  });

  it('detecta posibles asuntos duplicados', () => {
    expect(normalizarTitulo('  Iniciativa: Ley de Salud ')).toBe(normalizarTitulo('iniciativa ley de salúd'));
    const b = base({ asuntos: [asunto('A1', { titulo: 'Reforma a la Ley' }), asunto('A2', { titulo: 'reforma a la ley' })] });
    expect(categorias(b)).toContain('asunto_duplicado');
  });

  it('detecta diputaciones RP asociadas a un distrito y MR sin distrito', () => {
    const b = base({ diputados: [dip('D1', { tipo_representacion: 'RP', distrito: '3' }), dip('D2', { distrito: '' })] });
    expect(validarTodo(b).filter((p) => p.categoria === 'inconsistencia' && p.columna === 'distrito')).toHaveLength(2);
  });

  it('coteja totales oficiales contra votos individuales', () => {
    const b = base({
      diputados: [dip('D1'), dip('D2', { distrito: '2' })],
      sesiones: [sesion('S1', '2025-01-07')],
      votaciones: [{ id_votacion: 'V1', id_sesion: 'S1', descripcion: 'x', tipo_votacion: 'nominal', resultado: 'aprobado', total_favor: '3', total_contra: '0', total_abstencion: '0', id_fuente: 'EV-1', estado_verificacion: 'verificado' }],
      votos: [{ id_votacion: 'V1', id_diputado: 'D1', sentido: 'favor' }, { id_votacion: 'V1', id_diputado: 'D2', sentido: 'favor' }],
    });
    expect(validarTodo(b).some((p) => p.tabla === 'votos' && p.categoria === 'inconsistencia')).toBe(true);
  });

  it('rechaza clasificar un compromiso como incumplido sin evidencia', () => {
    const b = base({ diputados: [dip('D1')], compromisos: [{ id_compromiso: 'C1', descripcion: 'x', fecha_origen: '2025-01-01', estado_seguimiento: 'no_cumplido_documentado', id_fuente: 'EV-1' }], compromiso_participantes: [{ id_compromiso: 'C1', id_diputado: 'D1' }] });
    expect(validarTodo(b).some((p) => p.severidad === 'error' && p.tabla === 'compromisos')).toBe(true);
  });

  it('valores fuera de catálogo se reportan', () => {
    const b = base({ diputados: [dip('D1', { tipo_representacion: 'plurinominal' })] });
    expect(categorias(b)).toContain('valor_invalido');
  });

  it('un conjunto vacío no produce errores', () => {
    expect(validarTodo(base()).filter((p) => p.severidad === 'error')).toEqual([]);
  });
});

describe('lectura de CSV', () => {
  it('normaliza encabezados, recorta espacios, ignora BOM y conserva filas incompletas', () => {
    const { filas } = parsearCsv('﻿ID Diputado,Nombre Completo\n D1 , Ana \nD2,\n');
    expect(filas).toEqual([{ id_diputado: 'D1', nombre_completo: 'Ana' }, { id_diputado: 'D2', nombre_completo: '' }]);
  });
});
