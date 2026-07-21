import assert from 'node:assert/strict';
import test from 'node:test';
import { debeMostrarSeccionSimulada } from '../app/simulation/%5BidSimulacion%5D/components/reloj-simulacion.visibility.ts';

test('oculta el reloj simulado en operacion dia a dia', () => {
  assert.equal(debeMostrarSeccionSimulada('0'), false);
});

test('mantiene el reloj simulado en modos de simulacion', () => {
  assert.equal(debeMostrarSeccionSimulada('1'), true);
  assert.equal(debeMostrarSeccionSimulada('2'), true);
  assert.equal(debeMostrarSeccionSimulada(undefined), true);
});
