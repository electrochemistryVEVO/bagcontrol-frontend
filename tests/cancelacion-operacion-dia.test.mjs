import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const panel = readFileSync(
  new URL('../app/simulation/[idSimulacion]/components/panel-lateral.tsx', import.meta.url),
  'utf8',
)
const servicio = readFileSync(new URL('../app/services/simulation.service.ts', import.meta.url), 'utf8')
const hook = readFileSync(
  new URL('../app/simulation/[idSimulacion]/hooks/useSimulacion.ts', import.meta.url),
  'utf8',
)

test('modo 0 y modo 1 muestran cancelables con servicios separados', () => {
  assert.match(panel, /modo === '0' \|\| modo === '1'/)
  assert.match(panel, /modo === '0'[\s\S]*obtenerVuelosCancelablesOperacionDia/)
  assert.match(panel, /obtenerVuelosCancelables\([\s\S]*tiempoSimulacionRef\.current/)
  assert.match(panel, /Vuelos por salir/)
  assert.match(panel, /Vuelos cancelables/)
})

test('operacion no envia tiempo simulado y cancela la ocurrencia exacta', () => {
  assert.match(servicio, /obtenerVuelosCancelablesOperacionDia:[\s\S]*\/operacion-dia\/vuelos\/cancelables/)
  assert.match(servicio, /cancelarOcurrenciaOperacionDia:[\s\S]*codigoVuelo: vuelo\.codigoVuelo[\s\S]*salidaUtc: vuelo\.horaSalidaUtc/)
  assert.doesNotMatch(servicio, /obtenerVuelosCancelablesOperacionDia:[^\n]*instanteSimulado/)
})

test('conserva confirmacion bloqueo refresco y tratamiento de conflicto', () => {
  assert.match(panel, /window\.confirm/)
  assert.match(panel, /disabled=\{cancelandoVuelo === vuelo\.codigoVuelo\}/)
  assert.match(panel, /await cargarCancelables\(\)/)
  assert.match(panel, /response\?\.status === 409/)
  assert.match(panel, /envíos y.*maletas serán replanificados/)
})

test('eventos de cancelacion generan notificacion sin alterar vuelos activos', () => {
  assert.match(hook, /cancelaciones: lote\.eventos\.filter\(e => e\.tipo === 'VUELO_CANCELADO'\)/)
  assert.doesNotMatch(hook, /tipo === 'VUELO_CANCELADO'[\s\S]{0,200}vuelosActivos\.current\.delete/)
})
