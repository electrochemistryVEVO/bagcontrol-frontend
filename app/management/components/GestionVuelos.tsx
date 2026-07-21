'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { VueloService, VueloDTO, VueloPayload } from '@/app/services/vuelo.service'
import { CargaCsvModal } from './CargaCsvModal'
import { styles as S } from './RegistroEnvio'

const VACIO: VueloDTO = {
  origenIata: '', destinoIata: '', horaSalida: '00:00', horaLlegada: '00:00', capacidadMax: 0,
  estaCancelado: false,
}

const POR_PAGINA = 15

export function GestionVuelos() {
  const [vuelos, setVuelos] = useState<VueloDTO[]>([])
  const [modo, setModo] = useState<'crear' | 'editar' | null>(null)
  const [form, setForm] = useState<VueloDTO>({ ...VACIO })
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [csvAbierto, setCsvAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const registrarError = (contexto: string, error: unknown) => {
    console.error(`[VUELO-FRONT] ${contexto} - error completo`, error)
    console.error(
      `[VUELO-FRONT] ${contexto} - response data`,
      axios.isAxiosError(error) ? error.response?.data : undefined,
    )
    console.error(
      `[VUELO-FRONT] ${contexto} - status`,
      axios.isAxiosError(error) ? error.response?.status : undefined,
    )
    console.error(
      `[VUELO-FRONT] ${contexto} - message`,
      error instanceof Error ? error.message : String(error),
    )
  }

  const cargar = async (mostrarError = true): Promise<boolean> => {
    console.log('[VUELO-FRONT] recargando vuelos')
    try {
      const vuelosRecibidos = await VueloService.listarVuelos()
      console.log('[VUELO-FRONT] respuesta listar', vuelosRecibidos)
      setVuelos(vuelosRecibidos)
      setPagina(1)
      return true
    } catch (error) {
      registrarError('listar vuelos', error)
      if (mostrarError) setError('No se pudieron cargar los vuelos')
      return false
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => { setForm({ ...VACIO }); setModo('crear'); setError(null) }

  const abrirEditar = (v: VueloDTO) => {
    setForm({ ...v })
    setEditandoId(v.codigo ?? null)
    setModo('editar')
    setError(null)
  }

  const cerrar = () => { setModo(null); setEditandoId(null); setError(null) }

  const guardar = async () => {
    setError(null)
    if (!form.origenIata || !form.destinoIata) {
      setError('El origen y el destino son obligatorios')
      return
    }
    if (form.origenIata === form.destinoIata) {
      setError('El origen y el destino no pueden ser iguales')
      return
    }
    if (form.capacidadMax < 1) {
      setError('La capacidad debe ser al menos 1')
      return
    }
    const payload: VueloPayload = {
      origenIata: form.origenIata.trim().toUpperCase(),
      destinoIata: form.destinoIata.trim().toUpperCase(),
      horaSalida: form.horaSalida.slice(0, 5),
      horaLlegada: form.horaLlegada.slice(0, 5),
      capacidadMax: Number(form.capacidadMax),
      estaCancelado: modo === 'crear' ? false : form.estaCancelado,
    }

    console.log('[VUELO-FRONT] payload enviado', payload)
    setLoading(true)
    let vueloGuardado: VueloDTO
    try {
      if (modo === 'crear') {
        vueloGuardado = await VueloService.crearVuelo(payload)
        setVuelos(actuales => [vueloGuardado, ...actuales])
        flash('Vuelo creado exitosamente')
      } else if (modo === 'editar' && editandoId !== null) {
        vueloGuardado = await VueloService.actualizarVuelo(editandoId, payload)
        setVuelos(actuales =>
          actuales.map(vuelo => vuelo.codigo === editandoId ? vueloGuardado : vuelo),
        )
        flash('Vuelo actualizado exitosamente')
      } else {
        throw new Error('No se pudo determinar la operación de guardado')
      }
      console.log('[VUELO-FRONT] respuesta guardar', vueloGuardado)
      cerrar()
    } catch (error) {
      registrarError('guardar vuelo', error)
      setError('Error al guardar. Verifica los datos e intenta nuevamente.')
      setLoading(false)
      return
    }

    const recargaExitosa = await cargar(false)
    if (!recargaExitosa) {
      setError('Vuelo guardado, pero no se pudo refrescar la lista.')
    }
    setLoading(false)
  }

  const cancelar = async (id: number) => {
    if (!confirm('¿Cancelar este vuelo? Afectará a los envíos planificados sobre esta ruta.')) return
    try {
      await VueloService.cancelarVuelo(id)
      flash('Vuelo cancelado')
      cargar()
    } catch {
      setError('No se pudo cancelar el vuelo')
    }
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este vuelo permanentemente?')) return
    try {
      await VueloService.eliminarVuelo(id)
      flash('Vuelo eliminado')
      cargar()
    } catch {
      setError('No se pudo eliminar el vuelo')
    }
  }

  const flash = (msg: string) => { setExito(msg); setTimeout(() => setExito(null), 3000) }

  const field = (key: keyof VueloDTO, label: string, type = 'text') => (
    <div>
      <label style={S.label}>{label}</label>
      <input
        type={type} style={S.input}
        value={String(form[key] ?? '')}
        onChange={e => setForm(f => ({
          ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value,
        }))}
      />
    </div>
  )

  const vuelosFiltrados = vuelos.filter(vuelo =>
    `${vuelo.codigo ?? ''} ${vuelo.origenIata} ${vuelo.destinoIata}`.toLowerCase().includes(busqueda.trim().toLowerCase()),
  )
  const totalPaginas = Math.max(1, Math.ceil(vuelosFiltrados.length / POR_PAGINA))
  const filas = vuelosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={S.pageTitle}>Gestión de vuelos</h2>
          <p style={S.pageSubtitle}>Administra los planes de vuelo y sus capacidades</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setCsvAbierto(true)} style={S.btnSecondary}>⬆ Cargar CSV</button>
          <button onClick={abrirCrear} style={S.btnPrimary}>Registrar Vuelo</button>
        </div>
      </div>

      <input
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
        placeholder="Buscar por ID, origen o destino"
        style={{ ...S.input, maxWidth: 360, marginBottom: 16 }}
      />

      {csvAbierto && (
        <CargaCsvModal
          titulo="Cargar vuelos desde CSV"
          formato="ORIGEN-DESTINO-HH:MM-HH:MM-CAPACIDAD"
          ejemplo="SPIM-SBBR-10:30-22:45-150"
          onCargar={VueloService.cargarCsv}
          onCerrar={() => setCsvAbierto(false)}
          onExito={() => { setCsvAbierto(false); cargar() }}
        />
      )}

      {exito && <div style={{ ...S.alertSuccess, marginBottom: 16 }}>{exito}</div>}
      {error && !modo && <div style={{ ...S.alertError, marginBottom: 16 }}>{error}</div>}

      <div style={{ ...S.card, maxWidth: '100%', overflowX: 'auto' as const }}>
        <table style={S.table}>
          <thead>
            <tr>
              {['ID', 'Origen', 'Destino', 'Salida', 'Llegada', 'Capacidad', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>
                No hay vuelos cargados
              </td></tr>
            )}
            {filas.map(v => (
              <tr key={v.codigo}>
                <td style={{ ...S.td, fontWeight: 700, color: '#111827' }}>{v.codigo}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{v.origenIata}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{v.destinoIata}</td>
                <td style={S.td}>{v.horaSalida}</td>
                <td style={S.td}>{v.horaLlegada}</td>
                <td style={S.td}>{v.capacidadMax}</td>
                <td style={S.td}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: v.estaCancelado ? '#fef2f2' : '#f0fdf4',
                    color: v.estaCancelado ? '#b91c1c' : '#15803d',
                  }}>
                    {v.estaCancelado ? 'CANCELADO' : 'ACTIVO'}
                  </span>
                </td>
                <td style={{ ...S.td, display: 'flex', gap: 8 }}>
                  <button onClick={() => abrirEditar(v)} style={S.btnEdit}>Editar</button>
                  {!v.estaCancelado && v.codigo !== undefined && (
                    <button onClick={() => cancelar(v.codigo!)} style={{
                      ...S.btnDanger, background: '#fff7ed', color: '#c2410c',
                    }}>Cancelar</button>
                  )}
                  {v.codigo !== undefined && (
                    <button onClick={() => eliminar(v.codigo!)} style={S.btnDanger}>Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {vuelos.length > POR_PAGINA && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
          <button
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            disabled={pagina === 1}
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', color: '#111827' }}
          >‹</button>
          <span style={{ fontSize: 13, color: '#111827' }}>Página {pagina} de {totalPaginas}</span>
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas}
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', color: '#111827' }}
          >›</button>
        </div>
      )}

      {modo && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#0f172a' }}>
              {modo === 'crear' ? 'Nuevo vuelo' : `Editar vuelo #${editandoId}`}
            </h3>
            <div style={{ ...S.grid2, marginBottom: 20 }}>
              {field('origenIata', 'IATA Origen')}
              {field('destinoIata', 'IATA Destino')}
              {field('horaSalida', 'Hora de salida (HH:mm)', 'time')}
              {field('horaLlegada', 'Hora de llegada (HH:mm)', 'time')}
              <div style={{ gridColumn: '1 / -1' }}>
                {field('capacidadMax', 'Capacidad máxima de maletas', 'number')}
              </div>
            </div>
            {error && <div style={{ ...S.alertError, marginBottom: 16 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
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
  width: 560, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}
