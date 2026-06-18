'use client'
import { useState, useEffect } from 'react'
import { AeropuertoService } from '@/app/services/aeropuerto.service'
import { EnvioService, NuevoEnvioDTO } from '@/app/services/envio.service'
import { Aeropuerto } from '@/app/shared/types/Aeropuerto'

type Props = { onSuccess?: () => void }

export function RegistroEnvio({ onSuccess }: Props) {
  const [aeropuertos, setAeropuertos] = useState<Aeropuerto[]>([])
  const [form, setForm] = useState({
    origenIata: '',
    destinoIata: '',
    idCliente: '',
    cantidadMaletas: 1,
    fechaHora: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  useEffect(() => {
    AeropuertoService.listarAeropuertos()
      .then(({ data }) => setAeropuertos(data))
      .catch(() => setError('No se pudieron cargar los aeropuertos'))
  }, [])

  const handleSubmit = async () => {
    setError(null)
    if (!form.origenIata || !form.destinoIata || !form.idCliente || !form.fechaHora) {
      setError('Completa todos los campos obligatorios')
      return
    }
    if (form.origenIata === form.destinoIata) {
      setError('El origen y el destino no pueden ser el mismo aeropuerto')
      return
    }
    if (form.cantidadMaletas < 1) {
      setError('La cantidad de maletas debe ser al menos 1')
      return
    }
    setLoading(true)
    try {
      const payload: NuevoEnvioDTO = {
        origenIata: form.origenIata,
        destinoIata: form.destinoIata,
        idCliente: form.idCliente,
        cantidadMaletas: form.cantidadMaletas,
        fechaHora: new Date(form.fechaHora).toISOString(),
      }
      await EnvioService.registrarEnvio(payload)
      setExito(true)
      setForm({ origenIata: '', destinoIata: '', idCliente: '', cantidadMaletas: 1, fechaHora: '' })
      onSuccess?.()
      setTimeout(() => setExito(false), 3000)
    } catch {
      setError('Error al registrar el envío. Verifica que el servidor esté activo.')
    } finally {
      setLoading(false)
    }
  }

  const S = styles

  return (
    <div>
      <h2 style={S.pageTitle}>Registro de equipaje</h2>
      <p style={S.pageSubtitle}>Registra un nuevo envío de maletas en el sistema</p>

      <div style={S.card}>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Ingresa el origen</label>
            <select style={S.select} value={form.origenIata}
              onChange={e => setForm(f => ({ ...f, origenIata: e.target.value }))}>
              <option value="">Ingresa un aeropuerto</option>
              {aeropuertos.map(a => (
                <option key={a.codigoIata} value={a.codigoIata}>
                  {a.codigoIata} — {a.ciudad}, {a.pais}
                </option>
              ))}
            </select>
            <p style={S.hint}>Selecciona el aeropuerto de origen de la maleta</p>
          </div>

          <div>
            <label style={S.label}>Ingresa el destino</label>
            <select style={S.select} value={form.destinoIata}
              onChange={e => setForm(f => ({ ...f, destinoIata: e.target.value }))}>
              <option value="">Ingresa un aeropuerto</option>
              {aeropuertos.map(a => (
                <option key={a.codigoIata} value={a.codigoIata}>
                  {a.codigoIata} — {a.ciudad}, {a.pais}
                </option>
              ))}
            </select>
            <p style={S.hint}>Selecciona el aeropuerto de destino de la maleta</p>
          </div>

          <div>
            <label style={S.label}>Ingresa el cliente</label>
            <input type="text" style={S.input} placeholder="RUC o código de cliente"
              value={form.idCliente}
              onChange={e => setForm(f => ({ ...f, idCliente: e.target.value }))} />
            <p style={S.hint}>Ingresa el RUC o código del cliente que solicita el envío</p>
          </div>

          <div>
            <label style={S.label}>Seleccionar la cantidad de maletas a enviar</label>
            <input type="number" min={1} style={S.input} placeholder="Ingresa la cantidad"
              value={form.cantidadMaletas}
              onChange={e => setForm(f => ({ ...f, cantidadMaletas: Math.max(1, Number(e.target.value)) }))} />
            <p style={S.hint}>Cada maleta será registrada como un paquete por separado</p>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Fecha y hora de ingreso</label>
            <input type="datetime-local" style={S.input} value={form.fechaHora}
              onChange={e => setForm(f => ({ ...f, fechaHora: e.target.value }))} />
            <p style={S.hint}>Fecha y hora local de recepción en el aeropuerto de origen</p>
          </div>
        </div>

        {error && <div style={S.alertError}>{error}</div>}
        {exito && <div style={S.alertSuccess}>✓ Envío registrado exitosamente</div>}

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button onClick={handleSubmit} disabled={loading} style={{
            ...S.btnPrimary, background: loading ? '#94a3b8' : '#1e293b',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Registrando...' : 'Registrar envío'}
          </button>
          <button onClick={() => setForm({ origenIata: '', destinoIata: '', idCliente: '', cantidadMaletas: 1, fechaHora: '' })}
            style={S.btnSecondary}>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared styles object ────────────────────────────────────────────────────
export const styles = {
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 } as React.CSSProperties,
  pageSubtitle: { fontSize: 13, color: '#000000', marginBottom: 28 } as React.CSSProperties,
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: 28, maxWidth: 820,
  } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 } as React.CSSProperties,
  label: { display: 'block', fontWeight: 600, fontSize: 13, color: '#000000', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 12, color: '#000000', marginTop: 6 } as React.CSSProperties,
  select: {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: 14, background: '#fff',
    color: '#1e293b', outline: 'none', cursor: 'pointer',
  } as React.CSSProperties,
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: 14, background: '#fff',
    color: '#1e293b', outline: 'none', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  alertError: {
    marginTop: 20, padding: '10px 14px', borderRadius: 8,
    background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
  } as React.CSSProperties,
  alertSuccess: {
    marginTop: 20, padding: '10px 14px', borderRadius: 8,
    background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13,
  } as React.CSSProperties,
  btnPrimary: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: '#1e293b', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  } as React.CSSProperties,
  btnSecondary: {
    padding: '10px 24px', borderRadius: 8,
    border: '1px solid #e2e8f0', background: '#fff',
    color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  } as React.CSSProperties,
  btnDanger: {
    padding: '6px 14px', borderRadius: 6, border: 'none',
    background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 12, cursor: 'pointer',
  } as React.CSSProperties,
  btnEdit: {
    padding: '6px 14px', borderRadius: 6, border: 'none',
    background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: 12, cursor: 'pointer',
  } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, padding: '10px 12px', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#000000', fontSize: 12,
  } as React.CSSProperties,
  td: {
    padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#000000', fontWeight: 500,
  } as React.CSSProperties,
}
