'use client'
import React, { useState } from 'react'
import { GestionEnvios } from './components/GestionEnvios'
import { GestionAeropuertos } from './components/GestionAeropuertos'
import { GestionVuelos } from './components/GestionVuelos'
import { GestionIncidencias } from './components/GestionIncidencias'

type Seccion = 'envios' | 'aeropuertos' | 'vuelos' | 'incidencias' | null

type NavItem = {
  id: Exclude<Seccion, null>
  label: string
  icon: string
  grupo: 'gestion' | 'configuracion'
}

const NAV_ITEMS: NavItem[] = [
  { id: 'aeropuertos', label: 'Aeropuertos', icon: '🏛',  grupo: 'gestion' },
  { id: 'vuelos',      label: 'Vuelos',       icon: '✈️', grupo: 'gestion' },
  { id: 'envios',      label: 'Envíos',       icon: '📦', grupo: 'gestion' },
  { id: 'incidencias', label: 'Incidencias',  icon: '⚠️', grupo: 'configuracion' },
]

export default function ManagementPage() {
  const [seccion, setSeccion] = useState<Seccion>(null)

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 48px)', background: '#f8fafc' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: 240, background: '#fff', borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>
            Gestión de entidades
          </p>
          <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>operativas</p>
        </div>

        <nav style={{ flex: 1, padding: '12px 0' }}>
          <p style={groupLabelStyle}>Gestión</p>
          {NAV_ITEMS.filter(i => i.grupo === 'gestion').map(item => (
            <button key={item.id} onClick={() => setSeccion(item.id)} style={{
              ...navItemStyle,
              background: seccion === item.id ? '#f1f5f9' : 'transparent',
              color:      seccion === item.id ? '#0f172a'  : '#475569',
              fontWeight: seccion === item.id ? 600 : 400,
            }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <p style={{ ...groupLabelStyle, marginTop: 20 }}>Configuración</p>
          {NAV_ITEMS.filter(i => i.grupo === 'configuracion').map(item => (
            <button key={item.id} onClick={() => setSeccion(item.id)} style={{
              ...navItemStyle,
              paddingLeft: 32,
              background: seccion === item.id ? '#f1f5f9' : 'transparent',
              color:      seccion === item.id ? '#0f172a'  : '#475569',
              fontWeight: seccion === item.id ? 600 : 400,
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Contenido principal ─────────────────────────────────── */}
      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        {seccion === null       && <LandingGestion onSeleccionar={setSeccion} />}
        {seccion === 'envios'      && <GestionEnvios />}
        {seccion === 'aeropuertos' && <GestionAeropuertos />}
        {seccion === 'vuelos'      && <GestionVuelos />}
        {seccion === 'incidencias' && <GestionIncidencias />}
      </main>
    </div>
  )
}

// ─── Landing ─────────────────────────────────────────────────────────────────
function LandingGestion({ onSeleccionar }: { onSeleccionar: (s: Exclude<Seccion, null>) => void }) {
  const cards = [
    { id: 'aeropuertos' as const, icon: '🏛',  title: 'Aeropuertos',  desc: 'Crear, editar y eliminar aeropuertos del sistema' },
    { id: 'vuelos'      as const, icon: '✈️',  title: 'Vuelos',        desc: 'Gestionar planes de vuelo y cancelaciones' },
    { id: 'envios'      as const, icon: '📦',  title: 'Envíos',        desc: 'Registrar equipaje y consultar envíos activos' },
    { id: 'incidencias' as const, icon: '⚠️', title: 'Incidencias',   desc: 'Registrar bloqueos temporales de aeropuertos' },
  ]
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
        Gestión de entidades
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 36 }}>
        Selecciona una sección en el menú lateral o haz clic en una tarjeta para comenzar.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, maxWidth: 720 }}>
        {cards.map(c => (
          <button
            key={c.id}
            onClick={() => onSeleccionar(c.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 16, padding: 24,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              cursor: 'pointer', textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            <span style={{ fontSize: 32 }}>{c.icon}</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>{c.title}</p>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{c.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Estilos locales ──────────────────────────────────────────────────────────
const groupLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94a3b8',
  letterSpacing: 0.5, textTransform: 'uppercase',
  padding: '6px 20px 4px',
}
const navItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '8px 20px',
  border: 'none', cursor: 'pointer', textAlign: 'left',
  fontSize: 13, borderRadius: 6, transition: 'background 0.15s',
}
