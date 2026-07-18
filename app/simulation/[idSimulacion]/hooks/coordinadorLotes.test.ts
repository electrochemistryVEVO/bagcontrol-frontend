import test from 'node:test';
import assert from 'node:assert/strict';
import { CoordinadorLotes } from './coordinadorLotes.ts';
import type { EventoBatch } from '../../../shared/types/Evento';

const lote = (indice: number | null, version = 1, simulacionId = 'sim'): EventoBatch => ({
  simulacionId,
  numeroLote: indice ?? 99,
  indiceFisico: indice,
  versionPlan: version,
  ventanaInicio: indice == null ? null : `2026-07-20T0${indice}:00:00Z`,
  ventanaFin: indice == null ? null : `2026-07-20T0${indice + 1}:00:00Z`,
  cantidadEventos: indice == null ? 1 : 2,
  eventos: indice == null ? [{ tipo: 'SIMULACION_INICIADA', fechaHoraEvento: '2026-07-20T00:00:00Z' }] : [
    { tipo: 'B', fechaHoraEvento: `2026-07-20T0${indice}:20:00Z` },
    { tipo: 'A', fechaHoraEvento: `2026-07-20T0${indice}:10:00Z` },
  ],
  envios: [],
  saMs: 35_000,
});

test('primer, segundo y tercer lote ocupan actual, siguiente y cola posterior', () => {
  const buffer = new CoordinadorLotes('sim');
  buffer.recibir(lote(1));
  buffer.recibir(lote(2));
  buffer.recibir(lote(3));
  assert.equal(buffer.loteActual?.indiceFisico, 1);
  assert.equal(buffer.loteSiguiente?.indiceFisico, 2);
  assert.deepEqual(buffer.colaPosterior.map(item => item.indiceFisico), [3]);
  assert.equal(buffer.loteActual?.eventos[0].tipo, 'A');
});

test('promueve de forma continua sin perder el lote posterior', () => {
  const buffer = new CoordinadorLotes('sim');
  [1, 2, 3].forEach(indice => buffer.recibir(lote(indice)));
  assert.equal(buffer.promover()?.indiceFisico, 2);
  assert.equal(buffer.loteSiguiente?.indiceFisico, 3);
});

test('ignora duplicados, simulación ajena y mensajes de control', () => {
  const buffer = new CoordinadorLotes('sim');
  assert.equal(buffer.recibir(lote(null)).estado, 'control');
  assert.equal(buffer.recibir(lote(1, 1, 'otra')).estado, 'simulacion-invalida');
  assert.equal(buffer.recibir(lote(1)).estado, 'aceptado');
  assert.equal(buffer.recibir(lote(1)).estado, 'duplicado');
});

test('reordena fuera de orden y detecta huecos sin promoverlos', () => {
  const buffer = new CoordinadorLotes('sim');
  buffer.recibir(lote(1));
  const conHueco = buffer.recibir(lote(3));
  assert.equal(conHueco.estado === 'aceptado' && conHueco.huecoDetectado, true);
  assert.equal(buffer.loteSiguiente, null);
  buffer.recibir(lote(2));
  assert.equal(buffer.loteSiguiente?.indiceFisico, 2);
  assert.deepEqual(buffer.colaPosterior.map(item => item.indiceFisico), [3]);
});

test('versión nueva invalida futuros antiguos pero conserva el historial actual', () => {
  const buffer = new CoordinadorLotes('sim');
  [1, 2, 3].forEach(indice => buffer.recibir(lote(indice, 1)));
  buffer.recibir(lote(2, 2));
  assert.equal(buffer.loteActual?.indiceFisico, 1);
  assert.equal(buffer.loteSiguiente?.indiceFisico, 2);
  assert.equal(buffer.loteSiguiente?.versionPlan, 2);
  assert.deepEqual(buffer.colaPosterior, []);
  assert.equal(buffer.recibir(lote(3, 1)).estado, 'obsoleto');
});

test('cancelación invalida el futuro antes de recibir el bloque recalculado', () => {
  const buffer = new CoordinadorLotes('sim');
  buffer.recibir(lote(1, 1));
  buffer.recibir(lote(2, 1));
  const cancelacion = { ...lote(null, 2), eventos: [{
    tipo: 'VUELO_CANCELADO', fechaHoraEvento: '2026-07-20T01:30:00Z', codigoVuelo: 'anonimo',
  }] };
  assert.equal(buffer.recibir(cancelacion).estado, 'control');
  assert.equal(buffer.loteActual?.indiceFisico, 1);
  assert.equal(buffer.loteSiguiente, null);
  assert.equal(buffer.recibir(lote(2, 1)).estado, 'obsoleto');
  assert.equal(buffer.recibir(lote(2, 2)).estado, 'aceptado');
  assert.equal(buffer.loteSiguiente?.versionPlan, 2);
});

test('versión nueva de la ventana actual la reemplaza sin retroceder índices consumidos', () => {
  const buffer = new CoordinadorLotes('sim');
  buffer.recibir(lote(1, 1));
  const resultado = buffer.recibir(lote(1, 2));
  assert.equal(resultado.estado === 'aceptado' && resultado.reemplazoActual, true);
  assert.equal(buffer.loteActual?.versionPlan, 2);
  buffer.recibir(lote(2, 2));
  buffer.promover();
  assert.equal(buffer.recibir(lote(1, 3)).estado, 'obsoleto');
});

test('snapshot repetido no duplica lo consumido y saMs no se altera', () => {
  const buffer = new CoordinadorLotes('sim');
  const primero = lote(1);
  buffer.recibir(primero);
  buffer.recibir(lote(2));
  buffer.promover();
  assert.equal(buffer.recibir(primero).estado, 'obsoleto');
  assert.equal(buffer.loteActual?.saMs, 35_000);
});

test('dos coordinadores mantienen estado independiente', () => {
  const uno = new CoordinadorLotes('uno');
  const dos = new CoordinadorLotes('dos');
  uno.recibir(lote(1, 1, 'uno'));
  dos.recibir(lote(8, 4, 'dos'));
  assert.equal(uno.loteActual?.indiceFisico, 1);
  assert.equal(dos.loteActual?.indiceFisico, 8);
  assert.equal(uno.versionPlan, 1);
  assert.equal(dos.versionPlan, 4);
});
