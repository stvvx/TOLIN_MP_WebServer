import { useState, useEffect } from 'react'
import mqtt from 'mqtt/dist/mqtt.esm'

const BROKER_URL = import.meta.env.VITE_MQTT_URL
const BASE       = import.meta.env.VITE_MQTT_BASE_TOPIC
const TOPICS = {
  ammonia:   `${BASE}/ammonia`,
  ph:        `${BASE}/ph`,
  turbidity: `${BASE}/turbidity`,
  feed:      `${BASE}/feed/command`,
}

/* ─── styles ──────────────────────────────────────────────────────────── */
const css = `
  .tp {
    font-family: system-ui, -apple-system, sans-serif;
    background: #f3f0fe;
    min-height: 100vh;
    padding: 1.5rem;
  }

  /* ── hero ── */
  .tp-hero {
    background: #26215C;
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 1.25rem;
    position: relative;
  }
  .tp-hero__bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .tp-hero__circle {
    position: absolute;
    border-radius: 50%;
  }
  .tp-hero__circle--1 {
    width: 340px; height: 340px;
    background: #3C3489;
    top: -90px; right: -70px;
    opacity: 0.6;
  }
  .tp-hero__circle--2 {
    width: 190px; height: 190px;
    background: #534AB7;
    bottom: -70px; right: 90px;
    opacity: 0.5;
  }
  .tp-hero__circle--3 {
    width: 110px; height: 110px;
    background: #7F77DD;
    top: 30px; right: 170px;
    opacity: 0.3;
  }
  .tp-hero__inner {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 2rem 2rem 1.75rem;
  }
  .tp-eyebrow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #AFA9EC;
    font-weight: 500;
    margin-bottom: 8px;
  }
  .tp-eyebrow__dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #7F77DD;
    flex-shrink: 0;
  }
  .tp-hero__title {
    font-size: 36px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.06em;
    margin: 0 0 6px;
    line-height: 1.1;
  }
  .tp-hero__sub {
    font-size: 13px;
    color: #CECBF6;
    line-height: 1.6;
    max-width: 320px;
    margin: 0 0 16px;
  }
  .tp-hero__stats {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  .tp-stat__val {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    display: block;
  }
  .tp-stat__lbl {
    font-size: 11px;
    color: #AFA9EC;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── connection card ── */
  .tp-conn {
    background: rgba(255,255,255,0.07);
    border: 0.5px solid rgba(175,169,236,0.3);
    border-radius: 12px;
    padding: 14px 18px;
    min-width: 210px;
    align-self: flex-start;
    flex-shrink: 0;
  }
  .tp-conn__header {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 8px;
  }
  .tp-conn__dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .tp-conn__dot--good    { background: #97C459; animation: tp-pulse 2s infinite; }
  .tp-conn__dot--warning { background: #EF9F27; }
  .tp-conn__dot--neutral { background: #F09595; }
  @keyframes tp-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .tp-conn__label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #AFA9EC;
    font-weight: 500;
  }
  .tp-conn__value {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    margin-bottom: 4px;
  }
  .tp-conn__meta {
    font-size: 11px;
    color: #8880c0;
  }

  /* ── toolbar ── */
  .tp-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 14px 1.25rem;
    background: #fff;
    border: 0.5px solid #dcd8f8;
    border-radius: 12px;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }
  .tp-toolbar__left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tp-toolbar__icon {
    width: 36px; height: 36px;
    border-radius: 8px;
    background: #EEEDFE;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #534AB7;
    font-size: 18px;
    flex-shrink: 0;
  }
  .tp-toolbar__name {
    font-size: 14px;
    font-weight: 600;
    color: #26215C;
    display: block;
    margin-bottom: 2px;
  }
  .tp-toolbar__sub {
    font-size: 12px;
    color: #7F77DD;
  }
  .tp-feed-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 20px;
    border-radius: 8px;
    background: #534AB7;
    border: none;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.01em;
    transition: background 0.15s, transform 0.1s;
  }
  .tp-feed-btn:hover:not(:disabled) { background: #7F77DD; }
  .tp-feed-btn:active:not(:disabled) { transform: scale(0.98); }
  .tp-feed-btn:disabled { background: #e8e6f8; color: #a09cc8; cursor: not-allowed; }

  /* ── sensor cards ── */
  .tp-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 1.25rem;
  }
  .tp-card {
    background: #fff;
    border: 0.5px solid #dcd8f8;
    border-radius: 14px;
    padding: 1.25rem;
    position: relative;
    overflow: hidden;
  }
  .tp-card__accent {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: #7F77DD;
    border-radius: 14px 14px 0 0;
  }
  .tp-card__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .tp-card__icon {
    width: 40px; height: 40px;
    border-radius: 10px;
    background: #EEEDFE;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #534AB7;
    font-size: 20px;
  }
  .tp-card__badge {
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 999px;
    background: #EEEDFE;
    color: #534AB7;
    font-weight: 500;
    white-space: nowrap;
  }
  .tp-card__badge--active {
    background: #534AB7;
    color: #EEEDFE;
  }
  .tp-card__title {
    font-size: 12px;
    font-weight: 500;
    color: #8880c0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .tp-card__value {
    font-size: 34px;
    font-weight: 700;
    color: #26215C;
    line-height: 1;
    margin-bottom: 4px;
  }
  .tp-card__unit {
    font-size: 14px;
    font-weight: 400;
    color: #7F77DD;
    margin-left: 3px;
  }
  .tp-card__detail {
    font-size: 12px;
    color: #8880c0;
    margin-bottom: 0;
  }
  .tp-card__divider {
    border: none;
    border-top: 0.5px solid #EEEDFE;
    margin: 12px 0;
  }
  .tp-card__footer {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #7F77DD;
  }

  /* ── bottom grid ── */
  .tp-bottom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 1.25rem;
  }
  @media (max-width: 480px) { .tp-bottom { grid-template-columns: 1fr; } }

  .tp-summary {
    background: #26215C;
    border-radius: 14px;
    padding: 1.25rem;
  }
  .tp-summary__label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #AFA9EC;
    font-weight: 500;
    margin-bottom: 6px;
  }
  .tp-summary__text {
    font-size: 13px;
    color: #CECBF6;
    line-height: 1.6;
    margin: 0;
  }

  .tp-feed-card {
    background: #fff;
    border: 0.5px solid #dcd8f8;
    border-radius: 14px;
    padding: 1.25rem;
  }
  .tp-feed-card__label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #8880c0;
    font-weight: 500;
    margin-bottom: 10px;
  }
  .tp-feed-card__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tp-feed-card__val {
    font-size: 22px;
    font-weight: 700;
    color: #26215C;
  }
  .tp-feed-card__icon {
    width: 36px; height: 36px;
    border-radius: 8px;
    background: #EEEDFE;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #534AB7;
    font-size: 18px;
  }

  /* ── footer bar ── */
  .tp-footer {
    background: #fff;
    border: 0.5px solid #dcd8f8;
    border-radius: 12px;
    padding: 12px 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .tp-footer__brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tp-footer__dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #7F77DD;
  }
  .tp-footer__name {
    font-size: 13px;
    font-weight: 600;
    color: #26215C;
    letter-spacing: 0.04em;
  }
  .tp-footer__meta {
    font-size: 12px;
    color: #8880c0;
  }
  .tp-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tp-tag {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 999px;
    background: #EEEDFE;
    color: #534AB7;
    font-weight: 500;
    border: 0.5px solid #CECBF6;
  }
`

export default function TolinPage() {
  const [brokerStatus, setBrokerStatus] = useState('disconnected')
  const [esp32Status,  setEsp32Status]  = useState('offline')
  const [telemetry,    setTelemetry]    = useState({})
  const [sourceStatus, setSourceStatus] = useState(null)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [feedState,    setFeedState]    = useState('idle')
  const [client,       setClient]       = useState(null)

  useEffect(() => {
    setBrokerStatus('connecting')
    const mqttClient = mqtt.connect(BROKER_URL)

    mqttClient.on('connect', () => {
      setBrokerStatus('connected')
      mqttClient.subscribe([TOPICS.ammonia, TOPICS.ph, TOPICS.turbidity])
    })

    mqttClient.on('message', (topic, message) => {
      const raw = message.toString()
      setLastUpdated(new Date())
      setEsp32Status('online')
      try {
        const payload = JSON.parse(raw)
        if (topic === TOPICS.ammonia) {
          setSourceStatus(p => ({ ...p, ammonia: { ppm: payload.ppm, threshold: payload.threshold, pumpActive: payload.pumpActive } }))
          setTelemetry(p => ({ ...p, ammonia: payload.ppm }))
        }
        if (topic === TOPICS.ph) {
          setSourceStatus(p => ({ ...p, ph: { value: payload.value, threshold: payload.threshold, pumpActive: payload.pumpActive } }))
          setTelemetry(p => ({ ...p, ph: payload.value }))
        }
        if (topic === TOPICS.turbidity) {
          setSourceStatus(p => ({ ...p, turbidity: { ntu: payload.ntu, adc: payload.adc, pumpActive: payload.pumpActive } }))
          setTelemetry(p => ({ ...p, turbidity: payload.ntu }))
        }
      } catch (e) {
        console.warn('Non-JSON MQTT message:', raw)
      }
    })

    mqttClient.on('error',  (err) => { console.error(err); setBrokerStatus('disconnected') })
    mqttClient.on('close',  ()    => { setBrokerStatus('disconnected'); setEsp32Status('offline') })

    setClient(mqttClient)
    return () => mqttClient.end()
  }, [])

  function handleFeedNow() {
    if (!client || brokerStatus !== 'connected') return
    setFeedState('sending')
    client.publish(TOPICS.feed, JSON.stringify({ command: 'feed', ts: Date.now() }))
    setTimeout(() => setFeedState('queued'), 500)
    setTimeout(() => setFeedState('idle'),   3000)
  }

  function fmt(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—'
    return Number(value).toFixed(digits)
  }

  const connVariant =
    brokerStatus === 'connected'
      ? esp32Status === 'online' ? 'good' : 'warning'
      : brokerStatus === 'connecting' ? 'warning' : 'neutral'

  const connLabel =
    brokerStatus === 'connected'
      ? esp32Status === 'online'
        ? 'ESP32 online via MQTT'
        : 'Broker connected, waiting for ESP32'
      : brokerStatus === 'connecting'
        ? 'Connecting to MQTT broker…'
        : 'MQTT disconnected'

  const cards = [
    {
      key: 'ammonia',
      icon: 'ti-flask',
      title: 'Ammonia',
      value: fmt(sourceStatus?.ammonia?.ppm ?? telemetry?.ammonia, 2),
      unit: 'ppm',
      detail: `Threshold ${fmt(sourceStatus?.ammonia?.threshold, 2)} ppm`,
      badge: sourceStatus?.ammonia?.pumpActive ? 'Air pump ON' : 'Air pump OFF',
      active: !!sourceStatus?.ammonia?.pumpActive,
    },
    {
      key: 'ph',
      icon: 'ti-test-pipe',
      title: 'pH sensor',
      value: fmt(sourceStatus?.ph?.value ?? telemetry?.ph, 2),
      unit: '',
      detail: `Threshold ${fmt(sourceStatus?.ph?.threshold, 2)}`,
      badge: sourceStatus?.ph?.pumpActive ? 'Acid pump ON' : 'Pump OFF',
      active: !!sourceStatus?.ph?.pumpActive,
    },
    {
      key: 'turbidity',
      icon: 'ti-waves',
      title: 'Turbidity',
      value: sourceStatus?.turbidity?.ntu ?? telemetry?.turbidity ?? '—',
      unit: 'NTU',
      detail: `ADC ${sourceStatus?.turbidity?.adc ?? '—'}`,
      badge: sourceStatus?.turbidity?.pumpActive ? 'Pump ON' : 'Pump OFF',
      active: !!sourceStatus?.turbidity?.pumpActive,
    },
  ]

  const feedLabel =
    feedState === 'queued'  ? 'Queued' :
    feedState === 'sending' ? 'Sending…' :
    feedState === 'error'   ? 'Failed' : 'Idle'

  const summaryText =
    brokerStatus === 'connected'
      ? esp32Status === 'online'
        ? 'ESP32 is publishing live MQTT updates to Tolin station.'
        : 'Broker connected — waiting for ESP32 to publish data.'
      : 'Waiting for MQTT broker connection.'

  return (
    <>
      <style>{css}</style>
      <div className="tp">

        {/* Hero */}
        <section className="tp-hero">
          <div className="tp-hero__bg">
            <div className="tp-hero__circle tp-hero__circle--1" />
            <div className="tp-hero__circle tp-hero__circle--2" />
            <div className="tp-hero__circle tp-hero__circle--3" />
          </div>
          <div className="tp-hero__inner">
            <div>
              <div className="tp-eyebrow"><span className="tp-eyebrow__dot" />Station monitoring</div>
              <h1 className="tp-hero__title">TOLIN</h1>
              <p className="tp-hero__sub">
                Live sensor feed for ammonia, pH, and turbidity at the Tolin aquaculture station.
              </p>
              <div className="tp-hero__stats">
                <div><span className="tp-stat__val">3</span><span className="tp-stat__lbl">Sensors</span></div>
                <div><span className="tp-stat__val">{lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</span><span className="tp-stat__lbl">Last ping</span></div>
                <div><span className="tp-stat__val">MQTT</span><span className="tp-stat__lbl">Protocol</span></div>
              </div>
            </div>
            <div className="tp-conn">
              <div className="tp-conn__header">
                <span className={`tp-conn__dot tp-conn__dot--${connVariant}`} />
                <span className="tp-conn__label">Connection</span>
              </div>
              <div className="tp-conn__value">{connLabel}</div>
              <div className="tp-conn__meta">
                {lastUpdated ? `Last update ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first reading'}
              </div>
            </div>
          </div>
        </section>

        {/* Toolbar */}
        <div className="tp-toolbar">
          <div className="tp-toolbar__left">
            <div className="tp-toolbar__icon"><i className="ti ti-antenna" aria-hidden="true" /></div>
            <div>
              <span className="tp-toolbar__name">Tolin Station</span>
              <span className="tp-toolbar__sub">Ammonia · pH sensor · Turbidity monitoring</span>
            </div>
          </div>
          <button
            className="tp-feed-btn"
            type="button"
            onClick={handleFeedNow}
            disabled={brokerStatus !== 'connected' || feedState === 'sending'}
          >
            <i className="ti ti-fish" aria-hidden="true" />
            {feedState === 'sending' ? 'Queuing…' : 'Feed now'}
          </button>
        </div>

        {/* Sensor Cards */}
        <div className="tp-cards">
          {cards.map(card => (
            <article className="tp-card" key={card.key}>
              <div className="tp-card__accent" />
              <div className="tp-card__top">
                <div className="tp-card__icon"><i className={`ti ${card.icon}`} aria-hidden="true" /></div>
                <span className={`tp-card__badge${card.active ? ' tp-card__badge--active' : ''}`}>{card.badge}</span>
              </div>
              <div className="tp-card__title">{card.title}</div>
              <div className="tp-card__value">
                {card.value}
                {card.unit && <span className="tp-card__unit">{card.unit}</span>}
              </div>
              <p className="tp-card__detail">{card.detail}</p>
              <hr className="tp-card__divider" />
              <div className="tp-card__footer">
                <i className="ti ti-clock" style={{ fontSize: 13 }} aria-hidden="true" />
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Awaiting data'}
              </div>
            </article>
          ))}
        </div>

        {/* Bottom grid */}
        <div className="tp-bottom">
          <div className="tp-summary">
            <div className="tp-summary__label">Live summary</div>
            <p className="tp-summary__text">{summaryText}</p>
          </div>
          <div className="tp-feed-card">
            <div className="tp-feed-card__label">Feed action</div>
            <div className="tp-feed-card__row">
              <div className="tp-feed-card__val">{feedLabel}</div>
              <div className="tp-feed-card__icon">
                <i className="ti ti-player-play" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="tp-footer">
          <div className="tp-footer__brand">
            <span className="tp-footer__dot" />
            <span className="tp-footer__name">TOLIN</span>
            <span className="tp-footer__meta">Aquaculture Monitoring System</span>
          </div>
          <div className="tp-tags">
            {['MQTT', 'ESP32', 'Ammonia', 'pH', 'Turbidity'].map(t => (
              <span className="tp-tag" key={t}>{t}</span>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}