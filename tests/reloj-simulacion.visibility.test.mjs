import assert from 'node:assert/strict';
import test from 'node:test';
import { debeMostrarRelojSimulado } from '../app/simulation/%5BidSimulacion%5D/components/reloj-simulacion.visibility.ts';

test('oculta el reloj simulado en operacion dia a dia', () => {
  assert.equal(debeMostrarRelojSimulado('0'), false);
});

test('mantiene el reloj simulado en modos de simulacion', () => {
  assert.equal(debeMostrarRelojSimulado('1'), true);
  assert.equal(debeMostrarRelojSimulado('2'), true);
  assert.equal(debeMostrarRelojSimulado(undefined), true);
});
