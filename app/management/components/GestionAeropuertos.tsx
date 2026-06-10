'use client'
import { useState, useEffect } from 'react'
import { AeropuertoService, NuevoAeropuertoDTO, ActualizarAeropuertoDTO } from '@/app/services/aeropuerto.service'
import { Aeropuerto } from '@/app/shared/types/Aeropuerto'
import { styles as S } from './RegistroEnvio'

type ModoModal = 'crear' | 'editar' | null

const VACIO: NuevoAeropuertoDTO = {
  codigoIata: '', ciudad: '', pais: '', continente: '',
  gmt: 0, capacidadAlmacen: 0, latitud: 0, longitud: 0,
}

const POR_PAGINA = 15

export function GestionAeropuertos() {
  const [aeropuertos, setAeropuertos] = useState<Aeropuerto[]>([])
  const [modo, setModo] = useState<ModoModal>(null)
  const [form, setForm] = useState<NuevoAeropuertoDTO>({ ...VACIO })
  const [editandoIata, setEditandoIata] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)

  const cargar = () =>
    AeropuertoService.listarAeropuertos()
      .then(({ data }) => { setAeropuertos(data); setPagina(1) })
      .catch(() => setError('No se pudieron cargar los aeropuertos'))

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => { setForm({ ...VACIO }); setModo('crear'); setError(null) }

  const abrirEditar = (a: Aeropuerto) => {
    setForm({
      codigoIata: a.codigoIata, ciudad: a.ciudad, pais: a.pais,
      continente: a.continente, gmt: a.gmt, capacidadAlmacen: a.capacidadAlmacen,
      latitud: a.latitud, longitud: a.longitud,
    })
    setEditandoIata(a.codigoIata)
    setModo('editar')
    setError(null)
  }

  const cerrar = () => { setModo(null); setEditandoIata(null); setError(null) }

  const guardar = async () => {
    setError(null)
    if (!form.codigoIata || !form.ciudad || !form.pais) {
      setError('Código IATA, ciudad y país son obligatorios')
      return
    }
    setLoading(true)
    try {
      if (modo === 'crear') {
        await AeropuertoService.crearAeropuerto(form)
        flash('Aeropuerto creado exitosamente')
      } else if (modo === 'editar' && editandoIata) {
        const datos: ActualizarAeropuertoDTO = {
          ciudad: form.ciudad,
          pais: form.pais,
          continente: form.continente,
          gmt: form.gmt,
          capacidadAlmacen: form.capacidadAlmacen,
          latitud: form.latitud,
          longitud: form.longitud,
        }
        await AeropuertoService.actualizarAeropuerto(editandoIata, datos)
        flash('Aeropuerto actualizado exitosamente')
      }
      cerrar()
      cargar()
    } catch {
      setError('Error al guardar. Verifica los datos e intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const eliminar = async (iata: string) => {
    if (!confirm(`¿Eliminar el aeropuerto ${iata}? Esta acción no se puede deshacer.`)) return
    try {
      await AeropuertoService.eliminarAeropuerto(iata)
      flash('Aeropuerto eliminado')
      cargar()
    } catch {
      setError('No se pudo eliminar. Es posible que tenga vuelos asociados.')
    }
  }

  const flash = (msg: string) => {
    setExito(msg)
    setTimeout(() => setExito(null), 3000)
  }

  const field = (key: keyof NuevoAeropuertoDTO, label: string, type = 'text', disabled = false) => (
    <div>
      <label style={S.label}>{label}</label>
      <input
        type={type} disabled={disabled}
        style={{ ...S.input, background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#94a3b8' : '#1e293b' }}
        value={String(form[key] ?? '')}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
      />
    </div>
  )

  const totalPaginas = Math.max(1, Math.ceil(aeropuertos.length / POR_PAGINA))
  const filas = aeropuertos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={S.pageTitle}>Gestión de aeropuertos</h2>
          <p style={S.pageSubtitle}>Administra los aeropuertos registrados en el sistema</p>
        </div>
        <button onClick={abrirCrear} style={S.btnPrimary}>Registrar Aeropuerto</button>
      </div>

      {exito && <div style={{ ...S.alertSuccess, marginBottom: 16 }}>{exito}</div>}
      {error && !modo && <div style={{ ...S.alertError, marginBottom: 16 }}>{error}</div>}

      <div style={{ ...S.card, maxWidth: '100%', overflowX: 'auto' as const }}>
        <table style={S.table}>
          <thead>
            <tr>
              {['IATA', 'Ciudad', 'País', 'Continente', 'GMT', 'Capacidad', 'Lat', 'Lng', 'Acciones'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>
                No hay aeropuertos cargados
              </td></tr>
            )}
            {filas.map(a => (
              <tr key={a.codigoIata}>
                <td style={{ ...S.td, fontWeight: 700 }}>{a.codigoIata}</td>
                <td style={S.td}>{a.ciudad}</td>
                <td style={S.td}>{a.pais}</td>
                <td style={S.td}>{a.continente}</td>
                <td style={S.td}>{a.gmt >= 0 ? `+${a.gmt}` : a.gmt}</td>
                <td style={S.td}>{a.capacidadAlmacen.toLocaleString()}</td>
                <td style={S.td}>{a.latitud.toFixed(4)}</td>
                <td style={S.td}>{a.longitud.toFixed(4)}</td>
                <td style={{ ...S.td, display: 'flex', gap: 8 }}>
                  <button onClick={() => abrirEditar(a)} style={S.btnEdit}>Editar</button>
                  <button onClick={() => eliminar(a.codigoIata)} style={S.btnDanger}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {aeropuertos.length > POR_PAGINA && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
          <button
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            disabled={pagina === 1}
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', color: '#111827' }}
          >‹</button>
          <span style={{ fontSize: 13, color: '#64748b' }}>Página {pagina} de {totalPaginas}</span>
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas}
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', color: '#111827' }}
          >›</button>
        </div>
      )}

      {/* Modal */}
      {modo && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#0f172a' }}>
              {modo === 'crear' ? 'Nuevo aeropuerto' : `Editar ${editandoIata}`}
            </h3>
            <div style={{ ...S.grid2, marginBottom: 20 }}>
              {field('codigoIata', 'Código IATA', 'text', modo === 'editar')}
              {field('ciudad', 'Ciudad')}
              {field('pais', 'País')}
              {field('continente', 'Continente')}
              {field('gmt', 'GMT (offset horario)', 'number')}
              {field('capacidadAlmacen', 'Capacidad de almacén', 'number')}
              {field('latitud', 'Latitud', 'number')}
              {field('longitud', 'Longitud', 'number')}
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
  width: 640, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}
