import { useState } from 'react';
import { CONTACTO_CONGRESO } from '../config/contacto';
import type { Diputado } from '../datos/modelo';
import { EnlaceExterno } from './Fuente';

/** Acciones concretas para la ciudadanía después de leer la ficha. Solo datos publicados por el Congreso. */
export function QuePuedeHacer({ d }: { d: Diputado }) {
  const tel = CONTACTO_CONGRESO.telefonos;
  return (
    <section className="que-hacer" aria-label="¿Qué puede hacer usted?">
      <h4 className="ficha__seccion" style={{ marginTop: 0 }}>
        ¿Qué puede hacer usted?
      </h4>
      <ul className="pequeno">
        <li>
          <strong>Conocer su ficha oficial.</strong>{' '}
          {d.url_ficha_oficial ? <EnlaceExterno url={d.url_ficha_oficial}>En el sitio del Congreso</EnlaceExterno> : 'No está disponible'}. El Congreso no publica teléfono ni correo de cada diputación; puede llamar al Congreso:{' '}
          {tel.map((t, i) => (
            <span key={t}>
              <a href={`tel:+52${t.replace(/\D/g, '')}`}>{t}</a>
              {i < tel.length - 1 ? ', ' : ''}
            </span>
          ))}
          .
        </li>
        <li>
          <strong>Ir en persona.</strong> {CONTACTO_CONGRESO.domicilio}
        </li>
        <li>
          <strong>Saber qué se discutirá.</strong> <EnlaceExterno url={CONTACTO_CONGRESO.ordenDelDia}>Orden del día de las próximas sesiones</EnlaceExterno>.
        </li>
        <li>
          <strong>Pedir información.</strong> <EnlaceExterno url={CONTACTO_CONGRESO.transparencia}>Portal de transparencia del Congreso</EnlaceExterno>.
        </li>
      </ul>
    </section>
  );
}

/** Enlace directo al perfil, para compartir. Funciona con el enrutado por «#» de la página. */
function enlacePerfil(d: Diputado): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#/diputaciones/${encodeURIComponent(d.id_diputado)}`;
}

/** Botón «Compartir»: usa el menú del celular si existe; si no, WhatsApp y copiar el enlace. */
export function Compartir({ d }: { d: Diputado }) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const url = enlacePerfil(d);
  const texto = `¿Qué ha hecho ${d.nombre_completo} en el Congreso de Colima? Véalo en el Observatorio Legislativo:`;
  return (
    <span className="compartir">
      <button
        type="button"
        className="boton"
        aria-expanded={abierto}
        onClick={async () => {
          if (typeof navigator !== 'undefined' && navigator.share) {
            try {
              await navigator.share({ title: d.nombre_completo, text: texto, url });
              return;
            } catch (e) {
              if ((e as Error)?.name === 'AbortError') return;
            }
          }
          setAbierto(!abierto);
        }}
      >
        Compartir
      </button>
      {abierto && (
        <span className="compartir__opciones">
          <a className="boton boton--chico" href={`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <button
            type="button"
            className="boton boton--chico"
            onClick={() => {
              navigator.clipboard?.writeText(url).then(
                () => setCopiado(true),
                () => setCopiado(false),
              );
            }}
          >
            {copiado ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </span>
      )}
    </span>
  );
}
