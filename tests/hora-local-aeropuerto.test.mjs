import assert from 'node:assert/strict'
import test from 'node:test'
import { airportTimeEpoch, formatAirportLocalTime } from '../app/shared/airportTime.ts'

const midnightUtc = Date.parse('2026-01-01T00:00:00.000Z')

test('deriva varios GMT desde el mismo epoch UTC', () => {
  assert.equal(formatAirportLocalTime(midnightUtc, 0), '00:00')
  assert.equal(formatAirportLocalTime(midnightUtc, -5), '19:00')
  assert.equal(formatAirportLocalTime(midnightUtc, -3), '21:00')
  assert.equal(formatAirportLocalTime(midnightUtc, 1), '01:00')
  assert.equal(formatAirportLocalTime(midnightUtc, 5), '05:00')
})

test('formatea cruces de dia, minutos y segundos con cero inicial', () => {
  const epoch = Date.parse('2026-01-01T23:59:07.000Z')
  assert.equal(formatAirportLocalTime(epoch, -5), '18:59')
  assert.equal(formatAirportLocalTime(epoch, 1), '00:59')
  assert.equal(formatAirportLocalTime(epoch, 5, true), '04:59:07')
})

test('no depende de la zona horaria del proceso o navegador', () => {
  const original = process.env.TZ
  try {
    process.env.TZ = 'Pacific/Kiritimati'
    const primera = formatAirportLocalTime(midnightUtc, -5)
    process.env.TZ = 'America/Los_Angeles'
    assert.equal(formatAirportLocalTime(midnightUtc, -5), primera)
  } finally {
    process.env.TZ = original
  }
})

test('operacion diaria usa el epoch real y simulacion conserva el simulado', () => {
  const real = Date.parse('2026-07-21T20:00:00Z')
  const simulated = Date.parse('2030-01-01T12:00:00Z')
  assert.equal(airportTimeEpoch(true, real, simulated), real)
  assert.equal(airportTimeEpoch(false, real, simulated), simulated)
})

test('dos aeropuertos difieren solo por GMT y no existe caso especial SPIM', () => {
  assert.equal(formatAirportLocalTime(midnightUtc, -5), '19:00')
  assert.equal(formatAirportLocalTime(midnightUtc, 1), '01:00')
})
