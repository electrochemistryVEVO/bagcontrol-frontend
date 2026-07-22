import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { hasAllowedExtension } from '../app/shared/fileUpload.ts'

test('acepta TXT sin distinguir mayusculas y rechaza otras extensiones', () => {
  assert.equal(hasAllowedExtension('planes.txt', '.txt'), true)
  assert.equal(hasAllowedExtension('planes.TXT', '.txt'), true)
  for (const nombre of ['planes.csv', 'planes.xlsx', 'planes.docx', 'planes']) {
    assert.equal(hasAllowedExtension(nombre, '.txt'), false)
  }
})

test('la carga de vuelos muestra el contrato TXT y usa el endpoint nuevo', () => {
  const gestion = readFileSync(new URL('../app/management/components/GestionVuelos.tsx', import.meta.url), 'utf8')
  const servicio = readFileSync(new URL('../app/services/vuelo.service.ts', import.meta.url), 'utf8')
  assert.match(gestion, /Cargar vuelos desde TXT/)
  assert.match(gestion, /accept="\.txt,text\/plain"/)
  assert.match(gestion, /ORIGEN-DESTINO-HH:MM-HH:MM-CAPACIDAD/)
  assert.match(servicio, /\/vuelos\/cargar-txt/)
})

test('selector y drag-and-drop comparten validacion y los otros modulos conservan CSV', () => {
  const modal = readFileSync(new URL('../app/management/components/CargaCsvModal.tsx', import.meta.url), 'utf8')
  assert.match(modal, /extension = '\.csv'/)
  assert.match(modal, /accept = '\.csv,text\/csv'/)
  assert.match(modal, /const onInputChange[\s\S]*aceptarArchivo/)
  assert.match(modal, /const onDrop[\s\S]*aceptarArchivo\(f\)/)
})
