import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularEstadoCapacidadAeropuerto } from '../app/shared/simulation/semaforo.ts';

const aeropuerto = (maletasActuales, capacidadAlmacen = 440) => ({
  maletasActuales,
  capacidadAlmacen,
  porcentajeOcupacion: capacidadAlmacen > 0 ? (maletasActuales * 100) / capacidadAlmacen : 0,
});

test('publica VACIO cuando el inventario operativo esta vacio', () => {
  assert.equal(calcularEstadoCapacidadAeropuerto(aeropuerto(0)), 'VACIO');
});

test('publica VERDE para tres maletas de una capacidad de 440', () => {
  assert.equal(calcularEstadoCapacidadAeropuerto(aeropuerto(3)), 'VERDE');
});

test('recalcula cada fotografia sin conservar el estado anterior', () => {
  assert.equal(calcularEstadoCapacidadAeropuerto(aeropuerto(264)), 'AMARILLO');
  assert.equal(calcularEstadoCapacidadAeropuerto(aeropuerto(374)), 'ROJO');
  assert.equal(calcularEstadoCapacidadAeropuerto(aeropuerto(0)), 'VACIO');
});
