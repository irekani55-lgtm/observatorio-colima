import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { esquemaHexagonal, mapaDesdeGeojson, numeroDistrito } from '../src/mapa/geometria';

/** Cuadros sintéticos de prueba (NO son límites electorales). */
function cuadros(n: number, propiedad = 'DISTRITO_L', antihorario = true): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: n }, (_, i) => {
      const x = -104.6 + (i % 4) * 0.25;
      const y = 18.8 + Math.floor(i / 4) * 0.18;
      const anillo = [[x, y], [x + 0.2, y], [x + 0.2, y + 0.15], [x, y + 0.15], [x, y]];
      return { type: 'Feature', properties: { [propiedad]: String(i + 1).padStart(2, '0') }, geometry: { type: 'Polygon', coordinates: [antihorario ? anillo : [...anillo].reverse()] } };
    }),
  };
}

describe('geometría del mapa', () => {
  it('lee el número de distrito de distintas propiedades', () => {
    expect(numeroDistrito({ DISTRITO_L: '07' }, ['DISTRITO_L'])).toBe(7);
    expect(numeroDistrito({ distrito: 'Distrito 12' }, ['DISTRITO_L', 'distrito'])).toBe(12);
    expect(numeroDistrito({ otro: 1 }, ['DISTRITO_L'])).toBeNull();
  });

  it('convierte 16 polígonos en 16 formas dentro del lienzo, sin importar el sentido de los anillos', () => {
    for (const sentido of [true, false]) {
      const m = mapaDesdeGeojson(cuadros(16, 'DISTRITO_L', sentido), ['DISTRITO_L'], [-104.75, 18.62, -103.45, 19.56]);
      expect(m.formas).toHaveLength(16);
      expect(m.geografico).toBe(true);
      expect(m.advertencias).toEqual([]);
      for (const f of m.formas) {
        expect(f.d.length).toBeGreaterThan(10);
        expect(f.centro[0]).toBeGreaterThan(0);
        expect(f.centro[0]).toBeLessThan(m.ancho);
        expect(f.centro[1]).toBeGreaterThan(0);
        expect(f.centro[1]).toBeLessThan(m.alto);
      }
    }
  });

  it('advierte distritos faltantes', () => {
    const m = mapaDesdeGeojson(cuadros(14), ['DISTRITO_L'], [-104.75, 18.62, -103.45, 19.56]);
    expect(m.advertencias.join(' ')).toMatch(/15, 16/);
  });

  it('acepta coordenadas proyectadas en metros', () => {
    const fc = cuadros(16);
    for (const f of fc.features) if (f.geometry.type === 'Polygon') f.geometry.coordinates = f.geometry.coordinates.map((r) => r.map(([x, y]) => [(x + 105) * 100000 + 2_000_000, y * 110000]));
    const m = mapaDesdeGeojson(fc, ['DISTRITO_L'], [-104.75, 18.62, -103.45, 19.56]);
    expect(m.geografico).toBe(false);
    expect(m.formas).toHaveLength(16);
  });

  it('el esquema de respaldo tiene 16 hexágonos numerados', () => {
    const m = esquemaHexagonal();
    expect(m.formas.map((f) => f.distrito)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(m.geografico).toBe(false);
  });
});
