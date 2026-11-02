/**
 * Guarda un archivo generado en la página. Publicado en claude.ai, el dashboard vive dentro de un marco que
 * bloquea las descargas comunes; ahí se usa la capacidad `downloads` (la persona confirma antes de guardar).
 * Fuera de claude.ai (desarrollo local, otro servidor) se usa la descarga normal del navegador.
 */
type Guardado = 'guardado' | 'cancelado' | 'no_disponible';

interface CapacidadDescargas {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}

async function capacidadDescargas(): Promise<CapacidadDescargas | null> {
  const c = (globalThis as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!c?.use) return null;
  try {
    return ((await c.use('downloads')) as CapacidadDescargas | null) ?? null;
  } catch {
    return null;
  }
}

function descargaNormal(nombre: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function guardarArchivo(nombre: string, blob: Blob): Promise<Guardado> {
  const d = await capacidadDescargas();
  if (!d) {
    descargaNormal(nombre, blob);
    return 'guardado';
  }
  try {
    await d.save({ filename: nombre, data: blob });
    return 'guardado';
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'declined') return 'cancelado';
    return 'no_disponible';
  }
}
