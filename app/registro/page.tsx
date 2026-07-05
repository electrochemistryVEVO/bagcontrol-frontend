'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AeropuertoService } from '@/app/services/aeropuerto.service'
import { EnvioService, NuevoEnvioDTO } from '@/app/services/envio.service'
import { Aeropuerto } from '@/app/shared/types/Aeropuerto'
import { getUsuarioGuardado, cerrarSesion, UsuarioGuardado } from '@/app/shared/hooks/LoginModal'
import { AuthService } from '@/app/services/auth.service'
import {
  toDateTimeLocalInput,
  formatGmtOffset,
  convertLocalToUtcDisplay,
} from '@/app/shared/dateTime'

export default function RegistroPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioGuardado | null>(null)
  const [aeropuertos, setAeropuertos] = useState<Aeropuerto[]>([])
  const [form, setForm] = useState({
    destinoIata: '',
    idCliente: '',
    cantidadMaletas: 1,
    fechaHora: toDateTimeLocalInput(new Date()),
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [cargandoArchivo, setCargandoArchivo] = useState(false)
  const [mostrarSelectorAeropuerto, setMostrarSelectorAeropuerto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u = getUsuarioGuardado()
    if (!u) {
      router.replace('/')
      return
    }
    if (u.rol !== 'REGISTRADOR' && u.rol !== 'ADMINISTRADOR') {
      router.replace('/')
      return
    }
    setUsuario(u)

    AeropuertoService.listarAeropuertos()
      .then(({ data }) => setAeropuertos(data))
      .catch(() => setError('No se pudieron cargar los aeropuertos'))
  }, [router])

  if (!usuario) return null

  const aeropuertoActual = aeropuertos.find(a => a.codigoIata === usuario.aeropuerto)
  const origenIata = usuario.aeropuerto

  const handleSubmit = async () => {
    setError(null)
    if (!origenIata || !form.destinoIata || !form.idCliente) {
      setError('Completa todos los campos obligatorios')
      return
    }
    if (origenIata === form.destinoIata) {
      setError('El origen y el destino no pueden ser el mismo aeropuerto')
      return
    }
    if (form.cantidadMaletas < 1) {
      setError('La cantidad de maletas debe ser al menos 1')
      return
    }
    setGuardando(true)
    try {
      const payload: NuevoEnvioDTO = {
        origenIata,
        destinoIata: form.destinoIata,
        idCliente: form.idCliente,
        cantidadMaletas: form.cantidadMaletas,
        fechaHora: form.fechaHora || toDateTimeLocalInput(new Date()),
      }
      await EnvioService.registrarEnvio(payload)
      setExito(true)
      setForm(prev => ({ ...prev, idCliente: '', cantidadMaletas: 1, fechaHora: toDateTimeLocalInput(new Date()) }))
      setTimeout(() => setExito(false), 3000)
    } catch {
      setError('Error al registrar el envio. Verifica que el servidor este activo.')
    } finally {
      setGuardando(false)
    }
  }

  const handleCambiarAeropuerto = (codigoIata: string) => {
    AuthService.updateUser({ aeropuerto: codigoIata })
    setUsuario(prev => prev ? { ...prev, aeropuerto: codigoIata } : null)
    setMostrarSelectorAeropuerto(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCargandoArchivo(true)
    setError(null)
    try {
      const { data } = await EnvioService.cargarCsv(file, origenIata)
      setExito(true)
      setTimeout(() => setExito(false), 5000)
      if (data.errores && data.errores.length > 0) {
        setError(`Archivo procesado: ${data.insertados} insertados, ${data.errores.length} errores. ${data.errores.slice(0, 3).join('; ')}`)
      }
    } catch {
      setError('Error al procesar el archivo. Verifica el formato: idPedido-aaaammdd-hh-mm-dest-###-idCliente')
    } finally {
      setCargandoArchivo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const S = styles

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h2 style={S.pageTitle}>Registro de equipaje</h2>
          <p style={S.pageSubtitle}>
            {usuario.nombre} ({usuario.rol})
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#000000' }}>Operando desde:</span>
            <span style={{
              background: '#1e293b', color: '#fff', padding: '4px 10px',
              borderRadius: 6, fontSize: 12, fontWeight: 600,
            }}>
              {aeropuertoActual
                ? `${aeropuertoActual.codigoIata} — ${formatGmtOffset(aeropuertoActual.gmt)}`
                : origenIata || 'No asignado'}
            </span>
            <button
              onClick={() => setMostrarSelectorAeropuerto(!mostrarSelectorAeropuerto)}
              style={S.btnSmall}
            >
              Cambiar
            </button>
          </div>
          {mostrarSelectorAeropuerto && (
            <select
              style={{ ...S.select, width: 260, marginTop: 4, fontSize: 12 }}
              value={origenIata}
              onChange={e => handleCambiarAeropuerto(e.target.value)}
            >
              <option value="">Sin aeropuerto</option>
              {aeropuertos.map(a => (
                <option key={a.codigoIata} value={a.codigoIata}>
                  {a.codigoIata} — {a.ciudad}, {a.pais} ({formatGmtOffset(a.gmt)})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Aeropuerto destino</label>
            <select style={S.select} value={form.destinoIata}
              onChange={e => setForm(f => ({ ...f, destinoIata: e.target.value }))}>
              <option value="">Seleccionar aeropuerto</option>
              {aeropuertos.map(a => (
                <option key={a.codigoIata} value={a.codigoIata}>
                  {a.codigoIata} — {a.ciudad}, {a.pais}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={S.label}>Cliente (RUC o codigo)</label>
            <input type="text" style={S.input} placeholder="RUC o codigo de cliente"
              value={form.idCliente}
              onChange={e => setForm(f => ({ ...f, idCliente: e.target.value }))} />
          </div>

          <div>
            <label style={S.label}>Cantidad de maletas</label>
            <input type="number" min={1} style={S.input}
              value={form.cantidadMaletas}
              onChange={e => setForm(f => ({ ...f, cantidadMaletas: Math.max(1, Number(e.target.value)) }))} />
          </div>

          <div>
            <label style={S.label}>
              Fecha y hora de ingreso
              {aeropuertoActual && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                  ({formatGmtOffset(aeropuertoActual.gmt)})
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="datetime-local" style={{ ...S.input, flex: 1 }} value={form.fechaHora}
                onChange={e => setForm(f => ({ ...f, fechaHora: e.target.value }))} />
              <button type="button"
                onClick={() => setForm(f => ({ ...f, fechaHora: toDateTimeLocalInput(new Date()) }))}
                style={S.btnSecondary}>
                Ahora
              </button>
            </div>
            {aeropuertoActual && form.fechaHora && (
              <p style={{ ...S.hint, color: '#1d4ed8' }}>
                Equivale a: {convertLocalToUtcDisplay(form.fechaHora, aeropuertoActual.gmt)}
              </p>
            )}
          </div>
        </div>

        {error && <div style={S.alertError}>{error}</div>}
        {exito && <div style={S.alertSuccess}>Envio registrado exitosamente</div>}

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button onClick={handleSubmit} disabled={guardando} style={{
            ...S.btnPrimary, background: guardando ? '#94a3b8' : '#1e293b',
            cursor: guardando ? 'not-allowed' : 'pointer',
          }}>
            {guardando ? 'Guardando...' : 'Registrar envio'}
          </button>
          <button onClick={() => setForm({ destinoIata: '', idCliente: '', cantidadMaletas: 1, fechaHora: toDateTimeLocalInput(new Date()) })}
            style={S.btnSecondary}>
            Limpiar
          </button>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Carga masiva de envios</h3>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          Formato: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>idPedido-aaaammdd-hh-mm-dest-###-idCliente</code>
          &nbsp;· Origen asumido: <strong>{origenIata}</strong>
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            onChange={handleFileUpload}
            style={{ fontSize: 13 }}
          />
          {cargandoArchivo && <span style={{ fontSize: 13, color: '#64748b' }}>Procesando...</span>}
        </div>
      </div>
    </div>
  )
}

const styles = {
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 } as React.CSSProperties,
  pageSubtitle: { fontSize: 13, color: '#000000', marginBottom: 0 } as React.CSSProperties,
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: 28,
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
  btnSmall: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
    background: '#fff', color: '#1d4ed8', fontWeight: 600, fontSize: 11, cursor: 'pointer',
  } as React.CSSProperties,
}
