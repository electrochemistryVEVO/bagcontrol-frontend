'use client'
import { useRef, useState, useCallback } from 'react'

type ResultadoCarga = {
  insertados: number
  errores: string[]
  totalFilas: number
}

type Props = {
  titulo: string
  formato: string
  ejemplo: string
  onCargar: (archivo: File) => Promise<{ data: ResultadoCarga }>
  onCerrar: () => void
  onExito: () => void
}

export function CargaCsvModal({ titulo, formato, ejemplo, onCargar, onCerrar, onExito }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const aceptarArchivo = (f: File | null) => {
    if (!f) return
    setArchivo(f)
    setResultado(null)
    setErrorGeneral(null)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    aceptarArchivo(e.target.files?.[0] ?? null)
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const f = e.dataTransfer.files?.[0] ?? null
    aceptarArchivo(f)
  }, [])

  const enviar = async () => {
    if (!archivo) return
    setLoading(true)
    setErrorGeneral(null)
    setResultado(null)
    try {
      const { data } = await onCargar(archivo)
      setResultado(data)
      if (data.insertados > 0 && data.errores.length === 0) {
        setTimeout(onExito, 1200)
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message
      if (serverMsg) {
        setErrorGeneral(serverMsg)
      } else if (err?.response?.status === 401) {
        setErrorGeneral('Sesión expirada. Inicia sesión nuevamente.')
      } else {
        setErrorGeneral('No se pudo procesar el archivo. Verifica el formato e intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const resetear = () => {
    setResultado(null)
    setArchivo(null)
    setErrorGeneral(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const tieneErrores = resultado && resultado.errores.length > 0
  const todoOk = resultado && resultado.insertados > 0 && resultado.errores.length === 0

  const borderColor = dragging ? '#3b82f6' : archivo ? '#6366f1' : '#cbd5e1'
  const zonaBg = dragging ? '#eff6ff' : archivo ? '#f5f3ff' : '#f8fafc'

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={modalStyle}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>{titulo}</h3>
          <button
            onClick={onCerrar}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 0 }}
          >✕</button>
        </div>

        {/* Formato */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
          <p style={labelSmall}>Formato esperado por fila</p>
          <code style={codeStyle}>{formato}</code>
          <p style={{ ...labelSmall, marginTop: 8 }}>Ejemplo</p>
          <code style={{ ...codeStyle, color: '#475569' }}>{ejemplo}</code>
        </div>

        {/* Zona drag-and-drop / selector */}
        {!resultado && (
          <>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${borderColor}`,
                borderRadius: 10,
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: 16,
                background: zonaBg,
                transition: 'border-color 0.15s, background 0.15s',
                userSelect: 'none',
              }}
            >
              <p style={{ fontSize: 32, margin: 0, lineHeight: 1 }}>
                {dragging ? '📂' : archivo ? '📄' : '📁'}
              </p>

              {dragging ? (
                <p style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, marginTop: 10 }}>
                  Suelta el archivo aquí
                </p>
              ) : archivo ? (
                <>
                  <p style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600, marginTop: 10 }}>{archivo.name}</p>
                  <p style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>
                    {(archivo.size / 1024).toFixed(1)} KB — haz clic para cambiar
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: '#1e293b', marginTop: 10 }}>
                    Arrastra un archivo <strong>.csv</strong> aquí o haz clic para seleccionar
                  </p>
                  <p style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>Solo archivos .csv</p>
                </>
              )}

              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={onInputChange}
              />
            </div>

            {errorGeneral && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>{errorGeneral}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={enviar}
                disabled={!archivo || loading}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: !archivo || loading ? '#94a3b8' : '#1e293b',
                  color: '#fff', fontWeight: 600, fontSize: 14,
                  cursor: !archivo || loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Procesando…' : 'Subir archivo'}
              </button>
              <button onClick={onCerrar} style={btnSecondary}>Cancelar</button>
            </div>
          </>
        )}

        {/* Resultado */}
        {resultado && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={statBox('#f0fdf4', '#15803d')}>
                <p style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{resultado.insertados}</p>
                <p style={{ fontSize: 11, color: '#166534', margin: '2px 0 0' }}>Insertados</p>
              </div>
              <div style={statBox('#fef2f2', '#b91c1c')}>
                <p style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{resultado.errores.length}</p>
                <p style={{ fontSize: 11, color: '#991b1b', margin: '2px 0 0' }}>Con error</p>
              </div>
              <div style={statBox('#f8fafc', '#475569')}>
                <p style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{resultado.totalFilas}</p>
                <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Filas totales</p>
              </div>
            </div>

            {todoOk && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#166534', margin: 0, fontWeight: 600 }}>
                  ✓ Carga completada exitosamente. Cerrando…
                </p>
              </div>
            )}

            {tieneErrores && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>
                  Filas con error ({resultado.errores.length}):
                </p>
                <div style={{
                  maxHeight: 160, overflowY: 'auto',
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px',
                }}>
                  {resultado.errores.map((err, i) => (
                    <p key={i} style={{ fontSize: 12, color: '#b91c1c', margin: '2px 0', fontFamily: 'monospace' }}>{err}</p>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              {tieneErrores && resultado.insertados > 0 && (
                <button onClick={onExito} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#1e293b', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}>
                  Aceptar y cerrar
                </button>
              )}
              <button onClick={resetear} style={{ ...btnSecondary, flex: 1 }}>
                Cargar otro archivo
              </button>
              <button onClick={resultado.insertados > 0 ? onExito : onCerrar} style={btnSecondary}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Estilos ────────────────────────────────────────────────────────────────

function statBox(bg: string, color: string): React.CSSProperties {
  return { flex: 1, background: bg, borderRadius: 10, padding: '14px 16px', textAlign: 'center', color }
}

const labelSmall: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#111827',
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
}

const codeStyle: React.CSSProperties = {
  fontSize: 12, color: '#0f172a', fontFamily: 'monospace', display: 'block',
}

const btnSecondary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#fff', color: '#374151', fontWeight: 500, fontSize: 14, cursor: 'pointer',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
}

const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: 28,
  width: 520, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
}
