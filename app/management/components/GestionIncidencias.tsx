'use client'
import { useState, useEffect } from 'react'
import { IncidenciaService, IncidenciaDTO } from '@/app/services/incidencia.service'
import { AeropuertoService } from '@/app/services/aeropuerto.service'
import { Aeropuerto } from '@/app/shared/types/Aeropuerto'
import { styles as S } from './RegistroEnvio'

const VACIO: IncidenciaDTO = {
  fechaHora: '',
  descripcion: '',
  origenIata: '',
  noPuedeRecibir: false,
  noPuedeEnviar: false,
  tiempoRecuperacionMinutos: 60,
}

export function GestionIncidencias() {
  const [incidencias, setIncidencias] = useState<IncidenciaDTO[]>([])
  const [aeropuertos, setAeropuertos] = useState<Aeropuerto[]>([])
  const [modo, setModo] = useState<'crear' | 'editar' | null>(null)
  const [form, setForm] = useState<IncidenciaDTO>({ ...VACIO })
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const cargarIncidencias = () =>
    IncidenciaService.listarIncidencias()
      .then(({ data }) => setIncidencias(data))
      .catch(() => setError('No se pudieron cargar las incidencias'))

  useEffect(() => {
    cargarIncidencias()
    AeropuertoService.listarAeropuertos()
      .then(({ data }) => setAeropuertos(data))
  }, [])

  const abrirCrear = () => { setForm({ ...VACIO }); setModo('crear'); setError(null) }

  const abrirEditar = (i: IncidenciaDTO) => {
    setForm({ ...i, fechaHora: i.fechaHora ? i.fechaHora.slice(0, 16) : '' })
    setEditandoId(i.id ?? null)
    setModo('editar')
    setError(null)
  }

  const cerrar = () => { setModo(null); setEditandoId(null); setError(null) }

  const guardar = async () => {
    setError(null)
    if (!form.origenIata || !form.fechaHora) {
      setError('El aeropuerto y la fecha/hora son obligatorios')
      return
    }
    if (!form.noPuedeRecibir && !form.noPuedeEnviar) {
      setError('Selecciona al menos un tipo de bloqueo (no puede recibir o no puede enviar)')
      return
    }
    setLoading(true)
    try {
      const payload = { ...form, fechaHora: new Date(form.fechaHora).toISOString() }
      if (modo === 'crear') {
        await IncidenciaService.crearIncidencia(payload)
        flash('Incidencia registrada exitosamente')
      } else if (modo === 'editar' && editandoId !== null) {
        await IncidenciaService.actualizarIncidencia(editandoId, payload)
        flash('Incidencia actualizada exitosamente')
      }
      cerrar()
      cargarIncidencias()
    } catch {
      setError('Error al guardar la incidencia')
    } finally {
      setLoading(false)
    }
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta incidencia?')) return
    try {
      await IncidenciaService.eliminarIncidencia(id)
      flash('Incidencia eliminada')
      cargarIncidencias()
    } catch {
      setError('No se pudo eliminar la incidencia')
    }
  }

  const flash = (msg: string) => { setExito(msg); setTimeout(() => setExito(null), 3000) }

  return (
    <div>
      <h2 style={S.pageTitle}>Gestión de incidencias</h2>
      <p style={S.pageSubtitle}>
        Registra bloqueos temporales de aeropuertos. Las incidencias afectan automáticamente
        a los vuelos durante el rango de tiempo indicado.
      </p>

      {exito && <div style={{ ...S.alertSuccess, marginBottom: 16 }}>{exito}</div>}
      {error && !modo && <div style={{ ...S.alertError, marginBottom: 16 }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <button onClick={abrirCrear} style={S.btnPrimary}>+ Nueva incidencia</button>
      </div>

      <div style={{ ...S.card, maxWidth: '100%', overflowX: 'auto' as const }}>
        <table style={S.table}>
          <thead>
            <tr>
              {['ID', 'Aeropuerto', 'Fecha/Hora', 'Descripción', 'No envía', 'No recibe', 'Recuperación (min)', 'Acciones'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incidencias.length === 0 && (
              <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>
                No hay incidencias registradas
              </td></tr>
            )}
            {incidencias.map(i => (
              <tr key={i.id}>
                <td style={{ ...S.td, color: '#64748b' }}>{i.id}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{i.origenIata}</td>
                <td style={S.td}>{new Date(i.fechaHora).toLocaleString('es-PE')}</td>
                <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.descripcion || '—'}
                </td>
                <td style={S.td}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: i.noPuedeEnviar ? '#fef2f2' : '#f8fafc',
                    color: i.noPuedeEnviar ? '#b91c1c' : '#94a3b8',
                  }}>
                    {i.noPuedeEnviar ? 'SÍ' : 'NO'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: i.noPuedeRecibir ? '#fef2f2' : '#f8fafc',
                    color: i.noPuedeRecibir ? '#b91c1c' : '#94a3b8',
                  }}>
                    {i.noPuedeRecibir ? 'SÍ' : 'NO'}
                  </span>
                </td>
                <td style={S.td}>{i.tiempoRecuperacionMinutos}</td>
                <td style={{ ...S.td, display: 'flex', gap: 8 }}>
                  <button onClick={() => abrirEditar(i)} style={S.btnEdit}>Editar</button>
                  {i.id !== undefined && (
                    <button onClick={() => eliminar(i.id!)} style={S.btnDanger}>Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modo && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#0f172a' }}>
              {modo === 'crear' ? 'Nueva incidencia' : `Editar incidencia #${editandoId}`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>Aeropuerto afectado</label>
                <select style={S.select} value={form.origenIata}
                  onChange={e => setForm(f => ({ ...f, origenIata: e.target.value }))}>
                  <option value="">Selecciona un aeropuerto</option>
                  {aeropuertos.map(a => (
                    <option key={a.codigoIata} value={a.codigoIata}>
                      {a.codigoIata} — {a.ciudad}, {a.pais}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={S.label}>Fecha y hora de inicio</label>
                <input type="datetime-local" style={S.input} value={form.fechaHora}
                  onChange={e => setForm(f => ({ ...f, fechaHora: e.target.value }))} />
              </div>

              <div>
                <label style={S.label}>Tiempo de recuperación (minutos)</label>
                <input type="number" min={1} style={S.input}
                  value={form.tiempoRecuperacionMinutos}
                  onChange={e => setForm(f => ({ ...f, tiempoRecuperacionMinutos: Number(e.target.value) }))} />
              </div>

              <div>
                <label style={S.label}>Descripción (opcional)</label>
                <input type="text" style={S.input} placeholder="Ej: Tormenta, mantenimiento..."
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.noPuedeEnviar}
                    onChange={e => setForm(f => ({ ...f, noPuedeEnviar: e.target.checked }))} />
                  No puede enviar vuelos
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.noPuedeRecibir}
                    onChange={e => setForm(f => ({ ...f, noPuedeRecibir: e.target.checked }))} />
                  No puede recibir vuelos
                </label>
              </div>
            </div>

            {error && <div style={{ ...S.alertError, marginTop: 16 }}>{error}</div>}

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button onClick={guardar} disabled={loading} style={{
                ...S.btnPrimary, background: loading ? '#94a3b8' : '#1e293b',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={cerrar} style={S.btnSecondary}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 32,
  width: 520, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}
