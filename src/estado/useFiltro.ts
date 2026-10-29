import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Filtro } from '../indicadores/filtro';

/**
 * Filtros guardados en la URL: los enlaces conservan la vista exacta
 * (útil para compartir y para los enlaces "ver registros").
 */
export function useFiltro(): [Filtro, (cambios: Partial<Record<keyof Filtro, string | number | undefined>>) => void, URLSearchParams, (k: string | Record<string, string | undefined>, v?: string) => void] {
  const [params, setParams] = useSearchParams();

  const filtro = useMemo<Filtro>(() => {
    const anio = Number(params.get('anio'));
    const distrito = Number(params.get('distrito'));
    const tipo = params.get('representacion');
    return {
      anio: anio === 1 || anio === 2 || anio === 3 ? anio : undefined,
      desde: params.get('desde') || undefined,
      hasta: params.get('hasta') || undefined,
      partido: params.get('partido') || undefined,
      tipoRepresentacion: tipo === 'MR' || tipo === 'RP' ? tipo : undefined,
      distrito: Number.isInteger(distrito) && distrito > 0 ? distrito : undefined,
    };
  }, [params]);

  const claves: Record<keyof Filtro, string> = { anio: 'anio', desde: 'desde', hasta: 'hasta', partido: 'partido', tipoRepresentacion: 'representacion', distrito: 'distrito' };

  const actualizar = useCallback(
    (cambios: Partial<Record<keyof Filtro, string | number | undefined>>) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(cambios)) {
            const clave = claves[k as keyof Filtro];
            if (v === undefined || v === '') p.delete(clave);
            else p.set(clave, String(v));
          }
          return p;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  /** Cambia uno o varios parámetros en una sola navegación (evita que una actualización pise a otra). */
  const fijarParam = useCallback(
    (k: string | Record<string, string | undefined>, v?: string) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [clave, valor] of Object.entries(typeof k === 'string' ? { [k]: v } : k)) {
            if (!valor) p.delete(clave);
            else p.set(clave, valor);
          }
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  return [filtro, actualizar, params, fijarParam];
}
