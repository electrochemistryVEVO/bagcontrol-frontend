'use client'
import { useState, useEffect } from 'react'
import { RegistroEnvio } from './RegistroEnvio'

export function GestionEnvios() {
  const [vista, setVista] = useState<'lista' | 'registro'>('lista')
  const [envios, setEnvios] = useState<Array<{
    idPedido: string
    origenIata: string
    destinoIata: string
    fechaHora: string
    cantidadMaletas: number
    idCliente: string
  }>>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    setLoading(true)
    setErrorMsg('')

    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 30)
    const fechaInicio = inicio.toISOString().split('T')[0]

    fetch(`http://localhost:8090/api/envios/rango-dias?fechaInicio=${fechaInicio}&dias=60`)
      .then(r => r.json())
      .then(data => {
        setEnvios(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        setErrorMsg('No se pudieron cargar los envíos. Verifica que el servidor esté activo en localhost:8090.')
        setEnvios([])
      })
      .finally(() => setLoading(false))
  }, [])

  if (vista === 'registro') {
    return (
      <div>
        <button
          onClick={() => setVista('lista')}
          style={{ padding: '8px 16px', marginBottom: 20, cursor: 'pointer', borderRadius: 8, border: '1px solid #ccc', color: '#111827' }}
        >
          ← Volver a la lista
        </button>
        <RegistroEnvio onSuccess={() => setVista('lista')} />
      </div>
    )
  }

  const POR_PAGINA = 15
  const totalPaginas = Math.max(1, Math.ceil(envios.length / POR_PAGINA))
  const filas = envios.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Gestión de equipajes</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Envíos de los últimos 60 días</p>
        </div>
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
                <th key={col} style={{ textAlign: 'left' as const, padding: '10px 14px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#374151', fontSize: 12 }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center' as const, color: '#94a3b8' }}>Cargando envíos…</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center' as const, color: '#94a3b8' }}>No hay envíos registrados en este período</td></tr>
            ) : filas.map((e, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', color: '#111827' }}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontFamily: 'monospace' }}>{e.idPedido}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{e.origenIata}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{e.destinoIata}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                  {e.fechaHora ? new Date(e.fechaHora).toLocaleString('es-PE') : '—'}
                </td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{e.cantidadMaletas}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{e.idCliente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!loading && envios.length > POR_PAGINA && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
          <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', color: '#111827' }}>‹</button>
          <span style={{ fontSize: 13, color: '#64748b' }}>Página {pagina} de {totalPaginas}</span>
          <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', color: '#111827' }}>›</button>
        </div>
      )}
    </div>
  )
}
