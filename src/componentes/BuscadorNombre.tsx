import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatos } from '../estado/DatosContext';
import { enFunciones } from '../indicadores/filtro';
import { etiquetaSuplencia, licenciaVigente } from './FichaDiputado';

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** «¿Sabe su nombre?»: busca entre todas las personas que han ocupado un lugar y lleva a su perfil. */
export function BuscadorNombre() {
  const { base } = useDatos();
  const [texto, setTexto] = useState('');
  const q = normal(texto.trim());
  const palabras = q.split(/\s+/).filter(Boolean);
  const hallados = palabras.length && q.length >= 2 ? base.diputados.filter((d) => palabras.every((p) => normal(d.nombre_completo).includes(p))).slice(0, 6) : [];
  const corte = base.manifiesto.fecha_corte;
  const estado = (id: string) => {
    const d = base.idx.diputado.get(id)!;
    if (licenciaVigente(d)) return 'con licencia';
    if (!enFunciones(d, corte)) return 'ya no está en el cargo';
    return etiquetaSuplencia(d);
  };
  return (
    <div className="panel buscador-nombre">
      <h3 style={{ fontSize: '1.05rem', marginTop: 0 }}>¿Sabe su nombre?</h3>
      <p className="pequeno texto-2">Escriba el nombre o un apellido de la diputada o el diputado.</p>
      <div className="campo">
        <label htmlFor="buscar-nombre">Nombre</label>
        <input id="buscar-nombre" type="search" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Por ejemplo: Ochoa" />
      </div>
      <div aria-live="polite">
        {q.length >= 2 && hallados.length === 0 && <p className="pequeno texto-3">No encontramos a nadie con ese nombre. Revise cómo lo escribió.</p>}
        {hallados.length > 0 && (
          <ul className="lista-limpia buscador-nombre__lista">
            {hallados.map((d) => {
              const partido = base.idx.partido.get(d.id_partido)?.siglas ?? d.id_partido;
              const lugar = d.tipo_representacion === 'MR' ? `distrito ${d.distrito}` : 'por lista';
              const e = estado(d.id_diputado);
              return (
                <li key={d.id_diputado}>
                  <Link to={`/diputaciones/${encodeURIComponent(d.id_diputado)}`}>{d.nombre_completo}</Link>{' '}
                  <span className="muy-pequeno texto-3">
                    · {partido} · {lugar}
                    {e && ` · ${e}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="muy-pequeno" style={{ marginBottom: 0 }}>
        <Link to="/diputaciones">Ver la lista de las 25 diputaciones</Link>
      </p>
    </div>
  );
}
