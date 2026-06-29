import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'

const MQTT_URL = import.meta.env.VITE_MQTT_URL?.trim() || 'wss://broker.emqx.io:8084/mqtt'
const MQTT_BASE_TOPIC = import.meta.env.VITE_MQTT_BASE_TOPIC?.trim().replace(/\/+$/, '') || 'group1/mp'

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Number(value).toFixed(digits)
}

function topic(suffix) {
  return `${MQTT_BASE_TOPIC}/${suffix}`
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const c = {
  navy:        '#042C53',
  navyMid:     '#0C447C',
  navyLight:   '#185FA5',
  cardBg:      '#0a3660',
  cardBorder:  'rgba(55,138,221,0.25)',
  accent:      '#378ADD',
  accentBright:'#5DCAA5',
  text:        '#E6F1FB',
  textMuted:   '#85B7EB',
  textHint:    'rgba(85,183,235,0.6)',
  green:       '#9FE1CB',
  greenBg:     '#085041',
  greenBorder: '#1D9E75',
  warn:        '#EF9F27',
  red:         '#FCA5A5',
  redBg:       'rgba(26,10,10,0.8)',
  redBorder:   '#7F1D1D',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PulseDot({ online }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: online ? c.accentBright : c.warn,
        display: 'inline-block', position: 'relative', zIndex: 1,
      }} />
      {online && (
        <span style={{
          position: 'absolute', top: 0, left: 0,
          width: 13, height: 13, borderRadius: '50%',
          border: `1px solid ${c.accentBright}`,
          animation: 'aqua-ripple 2s ease-out infinite',
          opacity: 0.5,
        }} />
      )}
    </span>
  )
}

function Badge({ active, onLabel, offLabel }) {
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
      background:   active ? c.greenBg   : 'rgba(12,68,124,0.6)',
      color:        active ? c.green      : c.textMuted,
      border: `0.5px solid ${active ? c.greenBorder : 'rgba(24,95,165,0.4)'}`,
    }}>
      {active ? onLabel : offLabel}
    </span>
  )
}

function BarTrack({ pct, state }) {
  const fill = state === 'warn' ? c.warn : c.accentBright
  return (
    <div style={{ height: 3, background: 'rgba(55,138,221,0.15)', borderRadius: 2, marginTop: 10 }}>
      <div style={{
        height: 3, borderRadius: 2, background: fill,
        width: `${Math.min(100, Math.max(0, pct))}%`,
        transition: 'width 0.6s ease, background 0.3s',
      }} />
    </div>
  )
}

function SensorCard({ icon, title, value, unit, detail, badgeActive, onLabel, offLabel, barPct, barState }) {
  return (
    <div style={{
      background: c.cardBg,
      border: `0.5px solid ${c.cardBorder}`,
      borderRadius: 14, padding: 16,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* ghost circle */}
      <div style={{
        position: 'absolute', bottom: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(55,138,221,0.06)', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'rgba(55,138,221,0.15)',
          border: `0.5px solid rgba(55,138,221,0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, lineHeight: 1,
        }}>
          {icon}
        </div>
        <Badge active={badgeActive} onLabel={onLabel} offLabel={offLabel} />
      </div>

      <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {title}
      </div>
      <div style={{ fontSize: 32, fontWeight: 500, color: c.text, lineHeight: 1, marginBottom: 4 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 13, fontWeight: 400, color: c.textMuted, marginLeft: 3 }}>{unit}</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: c.textHint }}>{detail}</div>
      <BarTrack pct={barPct} state={barState} />
    </div>
  )
}

// ── Keyframes injected once ────────────────────────────────────────────────────
const STYLE = `
  @keyframes aqua-ripple {
    0%   { transform: scale(0.6); opacity: 0.6; }
    100% { transform: scale(1.3); opacity: 0; }
  }
`

// ── Main page ──────────────────────────────────────────────────────────────────
function TolinPage() {
  const clientRef = useRef(null)
  const [brokerStatus, setBrokerStatus] = useState('connecting')
  const [esp32Status,  setEsp32Status]  = useState('unknown')
  const [status,       setStatus]       = useState(null)
  const [telemetry,    setTelemetry]    = useState(null)
  const [error,        setError]        = useState('')
  const [feedState,    setFeedState]    = useState('idle')   // idle | sending | queued | error
  const [lastUpdated,  setLastUpdated]  = useState(null)

  // inject keyframes
  useEffect(() => {
    const tag = document.createElement('style')
    tag.textContent = STYLE
    document.head.appendChild(tag)
    return () => document.head.removeChild(tag)
  }, [])

  // MQTT
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clean: true, connectTimeout: 5000,
      clientId: `aqua-web-${Math.random().toString(16).slice(2, 10)}`,
      reconnectPeriod: 3000,
    })
    clientRef.current = client

    const subs = [topic('status'), topic('telemetry'), topic('status/availability')]

    client.on('connect',   () => { setBrokerStatus('connected'); setError(''); client.subscribe(subs) })
    client.on('reconnect', () => setBrokerStatus('connecting'))
    client.on('close',     () => setBrokerStatus('disconnected'))
    client.on('error',     (e) => { setBrokerStatus('error'); setError(e?.message || 'MQTT error') })

    client.on('message', (incomingTopic, payload) => {
      const msg = payload.toString()
      if (incomingTopic === topic('status')) {
        try {
          const data = JSON.parse(msg)
          setStatus(data)
          setEsp32Status(data.wifiConnected ? 'online' : 'offline')
          setLastUpdated(new Date())
          setError('')
        } catch { setError('Malformed status payload.') }
        return
      }
      if (incomingTopic === topic('telemetry')) {
        try { setTelemetry(JSON.parse(msg)); setLastUpdated(new Date()) }
        catch { setError('Malformed telemetry payload.') }
        return
      }
      if (incomingTopic === topic('status/availability')) {
        setEsp32Status(msg === 'online' ? 'online' : 'offline')
        setLastUpdated(new Date())
      }
    })

    return () => { client.end(true); clientRef.current = null }
  }, [])

  const handleFeedNow = () => {
    const client = clientRef.current
    if (!client || brokerStatus !== 'connected') { setError('MQTT broker is not connected yet.'); return }
    setFeedState('sending')
    client.publish(topic('feed'), '1', { qos: 1, retain: false }, (err) => {
      if (err) { setFeedState('error'); setError(err.message || 'Publish failed.') }
      else      { setFeedState('queued'); setError('') }
      setTimeout(() => setFeedState('idle'), 1800)
    })
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const src      = status || telemetry || {}
  const isOnline = brokerStatus === 'connected' && esp32Status === 'online'

  const connLabel =
    brokerStatus === 'connected'
      ? esp32Status === 'online'
        ? `ESP32 online via MQTT${status?.ip ? ` (${status.ip})` : ''}`
        : 'Broker connected, waiting for ESP32…'
      : brokerStatus === 'connecting'
        ? 'Connecting to MQTT broker…'
        : 'MQTT disconnected'

  const feedLabel =
    feedState === 'sending' ? 'Queuing…' :
    feedState === 'queued'  ? 'Queued ✓' :
    feedState === 'error'   ? 'Error'    : 'Feed now'

  // bar calculations
  const ammPpm   = src?.ammonia?.ppm ?? telemetry?.ammonia
  const ammThr   = src?.ammonia?.threshold
  const ammPct   = ammThr ? Math.min((ammPpm / ammThr) * 100, 100) : 0
  const ammState = ammPct > 80 ? 'warn' : 'ok'

  const phVal    = src?.ph?.value ?? telemetry?.ph
  const phPct    = Math.min((phVal / 14) * 100, 100) || 0
  const phState  = (phVal < 6 || phVal > 8) ? 'warn' : 'ok'

  const turbNtu  = src?.turbidity?.ntu ?? telemetry?.turbidity
  const turbPct  = Math.min((turbNtu / 100) * 100, 100) || 0
  const turbState= turbNtu > 50 ? 'warn' : 'ok'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: c.navy, minHeight: '100vh', fontFamily: 'sans-serif' }}>

      {/* Top bar */}
      <div style={{
        background: c.navy,
        borderBottom: `0.5px solid ${c.cardBorder}`,
        padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: c.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>
            💧
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: c.text, letterSpacing: '0.3px' }}>
            AquaControl
          </span>
        </div>

        {/* Status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(55,138,221,0.12)',
          border: `0.5px solid ${c.cardBorder}`,
          borderRadius: 20, padding: '5px 12px',
          fontSize: 11, color: c.textMuted,
        }}>
          <PulseDot online={isOnline} />
          {isOnline ? 'ESP32 online' : 'Waiting for ESP32'}
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px' }}>

        {/* Page heading */}
        <p style={{ fontSize: 16, fontWeight: 500, color: c.text, margin: '0 0 3px' }}>
          Water quality monitor
        </p>
        <p style={{ fontSize: 12, color: c.textMuted, margin: '0 0 20px' }}>
          Ammonia · pH · Turbidity — live MQTT readings
        </p>

        {/* Connection bar */}
        <div style={{
          background: 'rgba(4,44,83,0.8)',
          border: `0.5px solid ${c.cardBorder}`,
          borderRadius: 8, padding: '9px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: c.textMuted }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
              background: isOnline ? c.accentBright : c.warn,
            }} />
            Connection
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: isOnline ? c.green : c.warn }}>
            {connLabel}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: c.redBg,
            border: `0.5px solid ${c.redBorder}`,
            borderRadius: 8, padding: '9px 14px', marginBottom: 14,
            fontSize: 11, color: c.red,
          }}>
            {error}
          </div>
        )}

        {/* Sensor cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          <SensorCard
            icon="⚗"
            title="Ammonia"
            value={formatNumber(ammPpm, 2)}
            unit="ppm"
            detail={`Threshold ${formatNumber(ammThr, 2)} ppm`}
            badgeActive={!!src?.ammonia?.pumpActive}
            onLabel="Air pump ON"
            offLabel="Air pump OFF"
            barPct={ammPct}
            barState={ammState}
          />
          <SensorCard
            icon="〜"
            title="pH"
            value={formatNumber(phVal, 2)}
            unit=""
            detail={`Threshold ${formatNumber(src?.ph?.threshold, 2)}`}
            badgeActive={!!src?.ph?.pumpActive}
            onLabel="Acid pump ON"
            offLabel="Pump OFF"
            barPct={phPct}
            barState={phState}
          />
          <SensorCard
            icon="≋"
            title="Turbidity"
            value={src?.turbidity?.ntu ?? telemetry?.turbidity ?? '—'}
            unit="NTU"
            detail={`ADC ${src?.turbidity?.adc ?? '—'}`}
            badgeActive={!!src?.turbidity?.pumpActive}
            onLabel="Pump ON"
            offLabel="Pump OFF"
            barPct={turbPct}
            barState={turbState}
          />
        </div>

        {/* Toolbar */}
        <div style={{
          background: 'rgba(4,44,83,0.8)',
          border: `0.5px solid ${c.cardBorder}`,
          borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12,
        }}>
          <span style={{ color: c.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            🕐
            {lastUpdated ? `Last update ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first reading…'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => clientRef.current?.reconnect()}
              style={{
                fontSize: 11, padding: '6px 13px', borderRadius: 6,
                border: `0.5px solid rgba(55,138,221,0.4)`,
                background: 'transparent', color: c.textMuted,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              ↺ Reconnect
            </button>
            <button
              onClick={handleFeedNow}
              disabled={brokerStatus !== 'connected' || feedState === 'sending'}
              style={{
                fontSize: 11, padding: '6px 13px', borderRadius: 6,
                border: `0.5px solid ${c.greenBorder}`,
                background: c.greenBg, color: c.green,
                cursor: brokerStatus !== 'connected' ? 'not-allowed' : 'pointer',
                opacity: brokerStatus !== 'connected' ? 0.5 : 1,
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              🐟 {feedLabel}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default TolinPage