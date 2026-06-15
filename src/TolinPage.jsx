import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'

const MQTT_URL = import.meta.env.VITE_MQTT_URL?.trim() || 'wss://broker.emqx.io:8084/mqtt'
const MQTT_BASE_TOPIC = import.meta.env.VITE_MQTT_BASE_TOPIC?.trim().replace(/\/+$/, '') || 'group1/mp'

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Number(value).toFixed(digits)
}

function topic(suffix) {
  return `${MQTT_BASE_TOPIC}/${suffix}`
}

const colors = {
  bg:          '#0C447C',
  bgDeep:      '#042C53',
  bgCard:      '#042C53',
  border:      '#185FA5',
  accent:      '#378ADD',
  textPrimary: '#E6F1FB',
  textMuted:   '#85B7EB',
  textHint:    '#378ADD',
  green:       '#9FE1CB',
  greenBg:     '#085041',
  greenBorder: '#1D9E75',
}

function StatusBadge({ active, label }) {
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 8px',
      borderRadius: 20,
      background: active ? colors.greenBg   : colors.bg,
      color:      active ? colors.green      : colors.textMuted,
      border: `0.5px solid ${active ? colors.greenBorder : colors.border}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function SensorCard({ icon, title, value, unit, detail, stateLabel, active }) {
  return (
    <div style={{
      background: colors.bgCard,
      border: `0.5px solid ${colors.border}`,
      borderRadius: 12,
      padding: '16px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: '#185FA5',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16, color: colors.textMuted,
        }}>
          {icon}
        </div>
        <StatusBadge active={active} label={stateLabel} />
      </div>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 500, color: colors.textPrimary, marginBottom: 2 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 14, fontWeight: 400, color: colors.textMuted, marginLeft: 2 }}>
            {unit}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: colors.textHint }}>{detail}</div>
    </div>
  )
}

function TolinPage() {
  const clientRef = useRef(null)
  const [brokerStatus, setBrokerStatus] = useState('connecting')
  const [esp32Status, setEsp32Status]   = useState('unknown')
  const [status, setStatus]             = useState(null)
  const [telemetry, setTelemetry]       = useState(null)
  const [error, setError]               = useState('')
  const [feedState, setFeedState]       = useState('idle')
  const [lastUpdated, setLastUpdated]   = useState(null)

  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clean: true,
      connectTimeout: 5000,
      clientId: `group1-mp-web-${Math.random().toString(16).slice(2, 10)}`,
      reconnectPeriod: 3000,
    })
    clientRef.current = client

    const subs = [topic('status'), topic('telemetry'), topic('status/availability')]

    client.on('connect', () => {
      setBrokerStatus('connected')
      setError('')
      client.subscribe(subs)
    })
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
    if (!client || brokerStatus !== 'connected') {
      setError('MQTT broker is not connected yet.')
      return
    }
    setFeedState('sending')
    client.publish(topic('feed'), '1', { qos: 1, retain: false }, (err) => {
      if (err) { setFeedState('error'); setError(err.message || 'Publish failed.') }
      else      { setFeedState('queued'); setError('') }
      setTimeout(() => setFeedState('idle'), 1500)
    })
  }

  const src = status || telemetry || {}
  const isOnline = brokerStatus === 'connected' && esp32Status === 'online'

  const connectionLabel = brokerStatus === 'connected'
    ? esp32Status === 'online'
      ? `ESP32 online via MQTT${status?.ip ? ` (${status.ip})` : ''}`
      : 'Broker connected, waiting for ESP32…'
    : brokerStatus === 'connecting'
      ? 'Connecting to MQTT broker…'
      : 'MQTT disconnected'

  const feedLabel =
    feedState === 'sending' ? 'Queuing…' :
    feedState === 'queued'  ? 'Queued ✓' : 'Feed now'

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: 'sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{
        background: colors.bgDeep,
        borderBottom: `0.5px solid ${colors.border}`,
        padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary }}>
          AquaControl
        </span>
        <span style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 20,
          background: '#185FA5', color: colors.textMuted,
          border: `0.5px solid ${colors.accent}`,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isOnline ? '#5DCAA5' : '#EF9F27',
            display: 'inline-block',
          }} />
          {isOnline ? 'ESP32 online' : 'Waiting for ESP32'}
        </span>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: colors.textPrimary, margin: '0 0 4px' }}>
            Water quality monitor
          </h1>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: 0 }}>
            Ammonia · pH · Turbidity — live MQTT readings
          </p>
        </div>

        {/* Connection row */}
        <div style={{
          background: colors.bgDeep,
          border: `0.5px solid ${colors.border}`,
          borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20, fontSize: 12,
        }}>
          <span style={{ color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isOnline ? '#5DCAA5' : '#EF9F27',
              display: 'inline-block',
            }} />
            Connection
          </span>
          <span style={{ fontWeight: 500, color: isOnline ? colors.green : '#EF9F27' }}>
            {connectionLabel}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#1a0a0a',
            border: '0.5px solid #7F1D1D',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: '#FCA5A5',
          }}>
            {error}
          </div>
        )}

        {/* ── Sensor cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}>
          <SensorCard
            icon="⚗"
            title="Ammonia"
            value={formatNumber(src?.ammonia?.ppm ?? telemetry?.ammonia, 2)}
            unit="ppm"
            detail={`Threshold ${formatNumber(src?.ammonia?.threshold, 2)} ppm`}
            stateLabel={src?.ammonia?.pumpActive ? 'Air pump ON' : 'Air pump OFF'}
            active={!!src?.ammonia?.pumpActive}
          />
          <SensorCard
            icon="〜"
            title="pH"
            value={formatNumber(src?.ph?.value ?? telemetry?.ph, 2)}
            unit=""
            detail={`Threshold ${formatNumber(src?.ph?.threshold, 2)}`}
            stateLabel={src?.ph?.pumpActive ? 'Acid pump ON' : 'Pump OFF'}
            active={!!src?.ph?.pumpActive}
          />
          <SensorCard
            icon="≋"
            title="Turbidity"
            value={src?.turbidity?.ntu ?? telemetry?.turbidity ?? '-'}
            unit="NTU"
            detail={`ADC ${src?.turbidity?.adc ?? '-'}`}
            stateLabel={src?.turbidity?.pumpActive ? 'Pump ON' : 'Pump OFF'}
            active={!!src?.turbidity?.pumpActive}
          />
        </div>

        {/* ── Toolbar ── */}
        <div style={{
          background: colors.bgDeep,
          border: `0.5px solid ${colors.border}`,
          borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12,
        }}>
          <span style={{ color: colors.textMuted }}>
            {lastUpdated
              ? `Last update ${lastUpdated.toLocaleTimeString()}`
              : 'Waiting for first reading…'}
          </span>
          <div>
            <button
              onClick={() => clientRef.current?.reconnect()}
              style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 6,
                border: `0.5px solid ${colors.accent}`,
                background: 'transparent', color: colors.textMuted,
                cursor: 'pointer', marginRight: 8,
              }}
            >
              Reconnect
            </button>
            <button
              onClick={handleFeedNow}
              disabled={brokerStatus !== 'connected' || feedState === 'sending'}
              style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 6,
                border: `0.5px solid ${colors.greenBorder}`,
                background: colors.greenBg, color: colors.green,
                cursor: 'pointer',
                opacity: brokerStatus !== 'connected' ? 0.5 : 1,
              }}
            >
              {feedLabel}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default TolinPage