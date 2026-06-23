import type maplibregl from 'maplibre-gl';

// ============================================================================
// Carga un PNG con fondo transparente y genera N versiones coloreadas
// vía canvas source-in. NO usa sdf:true para evitar el halo de color.
// Se usa para los aviones, donde el ícono completo cambia de color.
// ============================================================================
export async function cargarIconosColoreados(
  map: maplibregl.Map,
  urlPng: string,
  prefijo: string,
  colores: Record<string, string>
) {
  const img = await map.loadImage(urlPng);
  const fuente = img.data as CanvasImageSource;
  const ancho = (fuente as any).width ?? 128;
  const alto  = (fuente as any).height ?? 128;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width  = ancho;
  maskCanvas.height = alto;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  maskCtx.drawImage(fuente, 0, 0, ancho, alto);
  const maskData = maskCtx.getImageData(0, 0, ancho, alto);
  for (let i = 3; i < maskData.data.length; i += 4) {
    maskData.data[i] = maskData.data[i] >= 110 ? 255 : 0;
  }

  for (const [sufijo, colorHex] of Object.entries(colores)) {
    const nombre = `${prefijo}-${sufijo}`;
    if (map.hasImage(nombre)) continue;
    const c = document.createElement('canvas');
    c.width  = ancho;
    c.height = alto;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(maskData, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, ancho, alto);
    map.addImage(nombre, ctx.getImageData(0, 0, ancho, alto));
  }
}

// ============================================================================
// Carga el ícono de AEROPUERTO con BORDE NEGRO FIJO y RELLENO interior
// coloreado por estado. A diferencia de cargarIconosColoreados (que tiñe todo
// el ícono, líneas incluidas), acá el contorno del PNG original nunca cambia
// de color: solo se pinta el área encerrada por esas líneas (el semáforo).
//
// Algoritmo: 1) binariza el alpha del PNG para detectar los píxeles de línea.
// 2) flood-fill desde los bordes del canvas para marcar el "exterior" (fondo).
// 3) lo que no es línea ni exterior es el "interior" encerrado por el dibujo,
//    y es lo único que se rellena con el color del estado.
// ============================================================================
export async function cargarIconosAeropuerto(
  map: maplibregl.Map,
  urlPng: string,
  prefijo: string,
  colores: Record<string, string>
) {
  const img = await map.loadImage(urlPng);
  const fuente = img.data as CanvasImageSource;
  const ancho = (fuente as any).width ?? 128;
  const alto  = (fuente as any).height ?? 128;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width  = ancho;
  baseCanvas.height = alto;
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true })!;
  baseCtx.drawImage(fuente, 0, 0, ancho, alto);
  const baseData = baseCtx.getImageData(0, 0, ancho, alto);

  const total = ancho * alto;
  // Píxeles de línea (contorno) del ícono original, según el alpha binarizado
  const esLinea = new Uint8Array(total);
  for (let i = 0, p = 0; i < baseData.data.length; i += 4, p++) {
    esLinea[p] = baseData.data[i + 3] >= 110 ? 1 : 0;
  }

  // Flood-fill desde los bordes del canvas: todo lo alcanzable sin cruzar una
  // línea es "exterior" (fondo del ícono). Lo que sobra (ni línea ni exterior)
  // es el "interior" encerrado por el contorno, que es lo que se colorea.
  const esExterior = new Uint8Array(total);
  const pila: number[] = [];
  const apilar = (idx: number) => {
    if (!esLinea[idx] && !esExterior[idx]) { esExterior[idx] = 1; pila.push(idx); }
  };
  for (let x = 0; x < ancho; x++) { apilar(x); apilar((alto - 1) * ancho + x); }
  for (let y = 0; y < alto; y++) { apilar(y * ancho); apilar(y * ancho + (ancho - 1)); }
  while (pila.length) {
    const idx = pila.pop()!;
    const x = idx % ancho;
    const y = (idx / ancho) | 0;
    if (x > 0) apilar(idx - 1);
    if (x < ancho - 1) apilar(idx + 1);
    if (y > 0) apilar(idx - ancho);
    if (y < alto - 1) apilar(idx + ancho);
  }

  for (const [sufijo, colorHex] of Object.entries(colores)) {
    const nombre = `${prefijo}-${sufijo}`;
    if (map.hasImage(nombre)) continue;

    const r = parseInt(colorHex.slice(1, 3), 16);
    const g = parseInt(colorHex.slice(3, 5), 16);
    const b = parseInt(colorHex.slice(5, 7), 16);

    const salida = new ImageData(ancho, alto);
    for (let i = 0, p = 0; i < salida.data.length; i += 4, p++) {
      if (esLinea[p]) {
        // Borde: siempre negro, fijo, sin importar el estado
        salida.data[i] = 0; salida.data[i + 1] = 0; salida.data[i + 2] = 0; salida.data[i + 3] = 255;
      } else if (!esExterior[p]) {
        // Interior encerrado por el contorno: coloreado según el estado
        salida.data[i] = r; salida.data[i + 1] = g; salida.data[i + 2] = b; salida.data[i + 3] = 255;
      }
    }
    map.addImage(nombre, salida);
  }
}
