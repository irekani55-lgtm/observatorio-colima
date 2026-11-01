import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProveedorDatosFijo } from '../src/estado/DatosContext';
import { Disposicion } from '../src/componentes/Disposicion';
import { Rutas } from '../src/rutas';
import type { ConjuntoCargado } from '../src/datos/cargar';
import { asunto, conjunto, dip, prom, sesion } from './ayudas';

// Recharts necesita ResizeObserver; jsdom no lo implementa.
beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  // Sin cartografía: el mapa debe usar el esquema de respaldo.
  globalThis.fetch = vi.fn(async () => new Response('no', { status: 404 })) as typeof fetch;
});

function montar(ruta: string, c: ConjuntoCargado) {
  return render(
    <ProveedorDatosFijo conjunto={c}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route element={<Disposicion />}>{Rutas()}</Route>
        </Routes>
      </MemoryRouter>
    </ProveedorDatosFijo>,
  );
}

const datos = () =>
  conjunto({
    diputados: [dip('D1', { nombre_completo: 'Ana Ejemplo', distrito: '3' }), dip('D2', { nombre_completo: 'Beto Ejemplo', tipo_representacion: 'RP', distrito: '', id_partido: 'PB' })],
    sesiones: [sesion('S1', '2025-01-07'), sesion('S2', '2025-01-14')],
    asistencias: [
      { id_sesion: 'S1', id_diputado: 'D1', estado: 'asistencia', id_fuente: 'EV-1' },
      { id_sesion: 'S2', id_diputado: 'D1', estado: 'ausencia', id_fuente: 'EV-1' },
    ],
    asuntos: [asunto('I1', { estado_procesal: 'aprobado', fecha_aprobacion: '2025-02-01' }), asunto('X1', { tipo: 'exhorto', estado_procesal: 'aprobado', fecha_aprobacion: '2025-02-01' })],
    asunto_promoventes: [prom('I1', 'D1'), prom('X1', 'D1')],
  });

describe('interfaz', () => {
  it('el inicio calcula las tarjetas a partir de los datos y muestra el aviso de demostración', async () => {
    montar('/', datos());
    expect(await screen.findByText(/DATOS DE DEMOSTRACIÓN/)).toBeInTheDocument();
    const tarjeta = screen.getByRole('heading', { name: 'Asistencia a sesiones del Pleno' }).closest('article')!;
    expect(within(tarjeta).getByText('50.0 %')).toBeInTheDocument();
    const ini = screen.getByRole('heading', { name: 'Iniciativas aprobadas' }).closest('article')!;
    expect(within(ini).getByText('1')).toBeInTheDocument();
  });

  it('sin datos muestra «pendiente de integración» en lugar de cifras', async () => {
    montar('/', conjunto());
    const tarjeta = (await screen.findByRole('heading', { name: 'Iniciativas presentadas' })).closest('article')!;
    expect(within(tarjeta).getByText(/pendiente de integración/i)).toBeInTheDocument();
  });

  it('el mapa permite seleccionar un distrito desde la lista y restablecer la vista', async () => {
    const u = userEvent.setup();
    montar('/mapa', datos());
    expect(await screen.findByText(/Esquema no geográfico/)).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Seleccionar distrito por número' });
    await u.click(within(lista).getByRole('button', { name: 'Distrito 3 · Ana Ejemplo' }));
    expect(within(lista).getByRole('button', { name: 'Distrito 3 · Ana Ejemplo' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('path[data-distrito="3"]')).toHaveClass('seleccionado');
    expect(screen.getByRole('heading', { name: 'Ana Ejemplo' })).toBeInTheDocument();
    expect(screen.getByText('Distrito electoral local 3', { selector: 'h2' })).toBeInTheDocument();
    // datos principales en lenguaje ciudadano
    const ficha = screen.getByRole('article', { name: 'Ficha de Ana Ejemplo' });
    expect(ficha).toHaveTextContent('Registró asistencia en 1 de 2 sesiones (50.0 %). Faltó sin permiso 1 vez.');
    expect(ficha).toHaveTextContent('Presentó 1 propuesta de ley; el Congreso aprobó 1.');
    expect(ficha).toHaveTextContent('(exhortos) 1 vez; el Congreso aprobó 1.');
    expect(ficha).toHaveTextContent('No ha hablado ante el Congreso');
    expect(screen.getByRole('link', { name: 'Ver su perfil completo' })).toHaveAttribute('href', '/diputaciones/D1');
    await u.click(screen.getByRole('button', { name: /Restablecer selección/ }));
    expect(screen.getByRole('heading', { name: 'Elija su distrito' })).toBeInTheDocument();
  });

  it('el mapa se puede operar con teclado', async () => {
    const u = userEvent.setup();
    montar('/mapa', datos());
    const forma = await screen.findByRole('button', { name: 'Distrito 5', pressed: false });
    forma.focus();
    await u.keyboard('{Enter}');
    expect(screen.getByText(/No hay una diputación de mayoría relativa registrada/)).toBeInTheDocument();
  });

  it('las diputaciones RP no se asocian a un distrito y tienen su propia ficha', async () => {
    const u = userEvent.setup();
    montar('/representacion-proporcional', datos());
    await u.click(await screen.findByRole('button', { name: /Beto Ejemplo/ }));
    expect(screen.getByRole('heading', { name: 'Beto Ejemplo' })).toBeInTheDocument();
    expect(screen.queryByText(/Distrito electoral local/)).not.toBeInTheDocument();
  });

  it('el perfil muestra fotografía no disponible y los registros de asistencia', async () => {
    montar('/diputaciones/D1', datos());
    expect(await screen.findByLabelText('Fotografía no disponible de Ana Ejemplo')).toBeInTheDocument();
    expect(screen.getByText('Ausencia registrada')).toBeInTheDocument();
  });

  it('los filtros de asuntos actualizan la tabla', async () => {
    montar('/asuntos?tipo=exhorto', datos());
    expect(await screen.findByText('Asunto X1')).toBeInTheDocument();
    expect(screen.queryByText('Asunto I1')).not.toBeInTheDocument();
  });
});
