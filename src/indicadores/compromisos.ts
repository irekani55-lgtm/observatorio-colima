import type { Base, Compromiso } from '../datos/modelo';
import { diputadoCumpleFiltro, fechaEnPeriodo, type Filtro } from './filtro';

export function compromisosFiltrados(b: Base, f: Filtro, idDiputado?: string): Compromiso[] {
  return b.compromisos.filter((c) => {
    if (!fechaEnPeriodo(c.fecha_origen, f)) return false;
    if (idDiputado && !c.participantes.some((p) => p.id_diputado === idDiputado)) return false;
    if (f.partido || f.tipoRepresentacion) {
      return c.participantes.some((p) => {
        const d = b.idx.diputado.get(p.id_diputado);
        return d ? diputadoCumpleFiltro(d, f) : false;
      });
    }
    return true;
  });
}
