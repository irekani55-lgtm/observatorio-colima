import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cargarConjunto, lectorFetch, resolverConjunto, type ConjuntoCargado } from '../datos/cargar';
import { construirBase, type Base } from '../datos/modelo';
import { validarTodo, type Problema } from '../datos/validar';
import { autoverificar } from '../indicadores/autoverificacion';

interface EstadoDatos {
  base: Base;
  problemas: Problema[];
  idConjunto: string;
}

const Ctx = createContext<EstadoDatos | null>(null);

export function useDatos(): EstadoDatos {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDatos debe usarse dentro de <ProveedorDatos>');
  return v;
}

/** Para pruebas: inyecta un conjunto ya cargado. */
export function ProveedorDatosFijo({ conjunto, children, idConjunto = 'prueba' }: { conjunto: ConjuntoCargado; children: ReactNode; idConjunto?: string }) {
  const valor = useMemo(() => {
    const base = construirBase(conjunto);
    return { base, problemas: [...validarTodo(base), ...autoverificar(base)], idConjunto };
  }, [conjunto, idConjunto]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function ProveedorDatos({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<{ conjunto: ConjuntoCargado; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const leer = lectorFetch(`${import.meta.env.BASE_URL}datos/`);
    let vivo = true;
    (async () => {
      try {
        const id = await resolverConjunto(leer, window.location.search);
        const conjunto = await cargarConjunto(leer, id);
        if (vivo) setEstado({ conjunto, id });
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (error)
    return (
      <div className="contenedor cargando" role="alert">
        <div>
          <h1>No fue posible cargar los datos</h1>
          <p>{error}</p>
          <p className="texto-2">Revise que exista la carpeta <code>public/datos/&lt;conjunto&gt;/</code> con su <code>manifiesto.json</code>.</p>
        </div>
      </div>
    );
  if (!estado)
    return (
      <div className="cargando" role="status" aria-live="polite">
        Cargando datos de la Legislatura…
      </div>
    );
  return (
    <ProveedorDatosFijo conjunto={estado.conjunto} idConjunto={estado.id}>
      {children}
    </ProveedorDatosFijo>
  );
}
