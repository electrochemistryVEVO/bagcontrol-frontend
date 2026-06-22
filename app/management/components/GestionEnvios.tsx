'use client'
import { useState, useEffect, useCallback } from 'react'
import { RegistroEnvio } from './RegistroEnvio'
import { CargaCsvModal } from './CargaCsvModal'
import { EnvioService, FiltrosEnvios } from '@/app/services/envio.service'
import { Envio } from '@/app/shared/types/Envio'

const POR_PAGINA = 15

export function GestionEnvios() {
  const [vista, setVista] = useState<'lista' | 'registro'>('lista')
  const [csvAbierto, setCsvAbierto] = useState(false)
  const [envios, setEnvios] = useState<Envio[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [pagina, setPagina] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalElementos, setTotalElementos] = useState(0)

  const [filtros, setFiltros] = useState<FiltrosEnvios>({})
  const [filtroOrigen, setFiltroOrigen] = useState('')
  const [filtroDestino, setFiltroDestino] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')

  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 30)
  const fechaInicio = inicio.toISOString().split('T')[0]

  const cargarEnvios = useCallback(async (page: number, filtrosActuales?: FiltrosEnvios) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data } = await EnvioService.listarEnviosPaginados(fechaInicio, 60, page, POR_PAGINA, filtrosActuales)
      setEnvios(data.content)
      setTotalPaginas(data.totalPages || 1)
      setTotalElementos(data.totalElements)
    } catch {
      setErrorMsg('No se pudieron cargar los envios. Verifica que el servidor este activo.')
      setEnvios([])
    } finally {
      setLoading(false)
    }
  }, [fechaInicio])

  useEffect(() => {
    cargarEnvios(0)
  }, [cargarEnvios])

  const aplicarFiltros = () => {
    const nuevosFiltros: FiltrosEnvios = {}
    if (filtroOrigen.trim()) nuevosFiltros.origenIata = filtroOrigen.trim().toUpperCase()
    if (filtroDestino.trim()) nuevosFiltros.destinoIata = filtroDestino.trim().toUpperCase()
    if (filtroCliente.trim()) nuevosFiltros.idCliente = filtroCliente.trim()
    if (filtroBusqueda.trim()) nuevosFiltros.q = filtroBusqueda.trim().toUpperCase()
    setFiltros(nuevosFiltros)
    setPagina(0)
    cargarEnvios(0, nuevosFiltros)
  }

  const limpiarFiltros = () => {
    setFiltroOrigen('')
    setFiltroDestino('')
    setFiltroCliente('')
    setFiltroBusqueda('')
    setFiltros({})
    setPagina(0)
    cargarEnvios(0)
  }

  const cambiarPagina = (nuevaPagina: number) => {
    setPagina(nuevaPagina)
    cargarEnvios(nuevaPagina, filtros)
  }

  if (vista === 'registro') {
    return (
      <div>
        <button
          onClick={() => { setVista('lista'); cargarEnvios(pagina, filtros) }}
          style={{ padding: '8px 16px', marginBottom: 20, cursor: 'pointer', borderRadius: 8, border: '1px solid #ccc', color: '#111827' }}
        >
          ← Volver a la lista
        </button>
        <RegistroEnvio onSuccess={() => { setVista('lista'); cargarEnvios(0, {}) }} />
      </div>
    )
  }

  const hayFiltros = Object.keys(filtros).length > 0

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#000000', margin: 0 }}>Gestión de equipajes</h2>
          <p style={{ fontSize: 13, color: '#000000', marginTop: 4 }}>
            Envíos de los últimos 60 días
            {!loading && <span style={{ marginLeft: 8 }}>({totalElementos.toLocaleString()} registros)</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setCsvAbierto(true)}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            ⬆ Cargar CSV
          </button>
          <button
            onClick={() => setVista('registro')}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#1e293b', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            Registrar Equipaje
          </button>
        </div>
      </div>

      {/* Barra de filtros */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, padding: '12px 16px',
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#000000', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Origen</label>
          <input
            value={filtroOrigen}
            onChange={e => setFiltroOrigen(e.target.value)}
            placeholder="Ej: SKBO"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#000000', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Destino</label>
          <input
            value={filtroDestino}
            onChange={e => setFiltroDestino(e.target.value)}
            placeholder="Ej: SKCL"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#000000', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Cliente</label>
          <input
            value={filtroCliente}
            onChange={e => setFiltroCliente(e.target.value)}
            placeholder="Ej: 0030823"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#000000', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Buscar código</label>
          <input
            value={filtroBusqueda}
            onChange={e => setFiltroBusqueda(e.target.value)}
            placeholder="Ej: SPIM"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={aplicarFiltros}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#1e293b', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Buscar
          </button>
          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {csvAbierto && (
        <CargaCsvModal
          titulo="Cargar envíos desde CSV"
          formato="origenIata,destinoIata,cantidadMaletas,idCliente,fechaHora"
          ejemplo="SPIM,SBBR,2,00135135,2026-06-12T05:23:00Z"
          onCargar={EnvioService.cargarCsv}
          onCerrar={() => setCsvAbierto(false)}
          onExito={() => { setCsvAbierto(false); cargarEnvios(0, {}) }}
        />
      )}

      {/* Error */}
      {errorMsg && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Código', 'Origen', 'Destino', 'Hora de registro', 'Maletas', 'Cliente'].map(col => (
                <th key={col} style={{ textAlign: 'left' as const, padding: '10px 14px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#000000', fontSize: 12 }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center' as const, color: '#374151' }}>Cargando envíos…</td></tr>
            ) : envios.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center' as const, color: '#374151' }}>
                {hayFiltros ? 'No hay envíos que coincidan con los filtros' : 'No hay envíos registrados en este período'}
              </td></tr>
            ) : envios.map((e, i) => (
              <tr key={e.idPedido} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontFamily: 'monospace', color: '#000' }}>{e.idPedido}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#000' }}>{e.origenIata}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#000' }}>{e.destinoIata}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#000' }}>
                  {e.fechaHora ? new Date(e.fechaHora).toLocaleString('es-PE') : '—'}
                </td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#000' }}>{e.cantidadMaletas}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#000' }}>{e.idCliente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!loading && totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => cambiarPagina(0)} disabled={pagina === 0}
            style={pagBtnStyle(pagina === 0)}>&laquo;</button>
          <button onClick={() => cambiarPagina(pagina - 1)} disabled={pagina === 0}
            style={pagBtnStyle(pagina === 0)}>&lsaquo;</button>
          {paginaActual(pagina, totalPaginas).map((p, i) =>
            p === '...' ? (
              <span key={`e-${i}`} style={{ padding: '6px 8px', color: '#94a3b8', fontSize: 13 }}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => cambiarPagina(p as number)}
                style={{
                  ...pagBtnStyle(false),
                  background: p === pagina ? '#1e293b' : '#fff',
                  color: p === pagina ? '#fff' : '#111827',
                  fontWeight: p === pagina ? 700 : 400,
                }}
              >
                {(p as number) + 1}
              </button>
            )
          )}
          <button onClick={() => cambiarPagina(pagina + 1)} disabled={pagina >= totalPaginas - 1}
            style={pagBtnStyle(pagina >= totalPaginas - 1)}>&rsaquo;</button>
          <button onClick={() => cambiarPagina(totalPaginas - 1)} disabled={pagina >= totalPaginas - 1}
            style={pagBtnStyle(pagina >= totalPaginas - 1)}>&raquo;</button>
          <span style={{ fontSize: 12, color: '#000000', marginLeft: 8 }}>
            Página {pagina + 1} de {totalPaginas.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}

function paginaActual(actual: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const paginas: (number | '...')[] = [0]
  if (actual > 3) paginas.push('...')
  const inicio = Math.max(1, actual - 1)
  const fin = Math.min(total - 2, actual + 1)
  for (let i = inicio; i <= fin; i++) paginas.push(i)
  if (actual < total - 4) paginas.push('...')
  paginas.push(total - 1)
  return paginas
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, color: '#111827', outline: 'none', background: '#fff',
}

function pagBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    background: '#fff', fontSize: 13, color: '#111827',
  }
}
