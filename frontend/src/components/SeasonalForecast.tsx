import { useEffect, useMemo, useRef, useState } from 'react'

export type MonthPoint = {
  label: string
  year: number
  month_number: number
  kwh: number
}

export type ForecastPoint = {
  label: string
  year: number
  month_number: number
  kwh: number
  method?: string
  kwh_2024?: number | null
  kwh_2025?: number | null
}

export type RegRow = {
  label: string
  x: number
  y: number
  dx: number
  dy: number
  product: number
  square: number
  predicted: number
}

export type Regression = {
  n: number
  x_mean: number
  y_mean: number
  a: number
  b: number
  r2: number
  note: string
  rows: RegRow[]
}

const num = (n: number) =>
  n.toLocaleString('en-PH', { maximumFractionDigits: 1 })

const money = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Plot = {
  label: string
  kwh: number
  kind: '2024' | '2025' | '2026 Forecast'
  x: number
}

function ZoomChart({ points, range }: { points: Plot[]; range: { start: number; end: number } }) {
  const [hover, setHover] = useState<number | null>(null)
  const [windowStart, setWindowStart] = useState(0)
  const [windowSize, setWindowSize] = useState(points.length)
  const [prevRange, setPrevRange] = useState(range)
  const drag = useRef<number | null>(null)

  if (range.start !== prevRange.start || range.end !== prevRange.end) {
    setPrevRange(range)
    setWindowStart(range.start)
    setWindowSize(range.end - range.start + 1)
    setHover(null)
  }

  const size = Math.max(3, Math.min(points.length, windowSize))
  const start = Math.max(0, Math.min(points.length - size, windowStart))
  const view = points.slice(start, start + size)

  const W = 920
  const H = 340
  const padL = 62
  const padR = 16
  const padT = 32
  const padB = 46

  const max = Math.max(1, ...view.map(p => p.kwh)) * 1.08
  const min = 0
  const xOf = (i: number) => padL + (i / Math.max(1, view.length - 1)) * (W - padL - padR)
  const yOf = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB)

  const line = (kind: Plot['kind']) => {
    let d = ''
    let started = false
    view.forEach((p, i) => {
      if (p.kind !== kind) {
        started = false
        return
      }
      const cmd = started ? 'L' : 'M'
      d += `${cmd}${xOf(i)},${yOf(p.kwh)} `
      started = true
    })
    return d.trim()
  }

  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const block = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const next = e.deltaY > 0
        ? Math.min(points.length, Math.ceil(size * 1.25))
        : Math.max(4, Math.floor(size * 0.8))
      const mid = start + size / 2
      setWindowSize(next)
      setWindowStart(Math.round(mid - next / 2))
    }
    el.addEventListener('wheel', block, { passive: false })
    return () => el.removeEventListener('wheel', block)
  }, [points.length, size, start])

  const active = hover === null ? null : view[hover]

  return (
    <div className="chart-wrap" ref={box}>
      <div className="export-actions" style={{ marginBottom: 12 }}>
        <button type="button" className="secondary" onClick={() => { setWindowSize(s => Math.max(4, Math.floor(s * 0.7))); }}>
          Zoom in
        </button>
        <button type="button" className="secondary" onClick={() => setWindowSize(s => Math.min(points.length, Math.ceil(s * 1.4)))}>
          Zoom out
        </button>
        <button type="button" className="secondary" onClick={() => { setWindowStart(0); setWindowSize(points.length) }}>
          Reset
        </button>
        <span className="muted" style={{ fontSize: '13px' }}>Ctrl + scroll to zoom. Drag the plot to pan. Hover a point for the monthly value.</span>
      </div>
      {active && (
        <div className="chart-tooltip" style={{ fontSize: '14px', padding: '10px 14px' }}>
          <b style={{ fontSize: '15px' }}>{active.label}</b><br />
          {active.kind}: <b>{num(active.kwh)} kWh</b>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Monthly historical and forecast chart per year"
        onMouseLeave={() => { setHover(null); drag.current = null }}
        onMouseDown={e => { drag.current = e.clientX }}
        onMouseUp={() => { drag.current = null }}
        onMouseMove={e => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          let best = 0
          let bestD = 1e9
          view.forEach((_, i) => {
            const d = Math.abs(xOf(i) - px)
            if (d < bestD) { bestD = d; best = i }
          })
          setHover(best)
          if (drag.current !== null && e.buttons === 1) {
            const dx = e.clientX - drag.current
            drag.current = e.clientX
            const shift = Math.round((-dx / rect.width) * size)
            if (shift) setWindowStart(s => s + shift)
          }
        }}
      >
        <text x={padL} y={padT - 10} fill="#334155" fontSize="13" fontWeight="700">kWh</text>

        {[0, 1, 2, 3, 4].map(i => {
          const v = max - (i * max) / 4
          const y = yOf(v)
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#E2E8F0" />
              <text x={padL - 10} y={y + 4} textAnchor="end" fill="#475569" fontSize="12" fontWeight="600">{num(v)}</text>
            </g>
          )
        })}

        <path d={line('2024')} fill="none" stroke="#2563EB" strokeWidth="3" />
        <path d={line('2025')} fill="none" stroke="#8B5CF6" strokeWidth="3" />
        <path d={line('2026 Forecast')} fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="6 4" />

        {view.map((p, i) => {
          const dotColor = p.kind === '2024' ? '#2563EB' : p.kind === '2025' ? '#8B5CF6' : '#10B981'
          return (
            <circle
              key={p.label + p.kind + i}
              cx={xOf(i)}
              cy={yOf(p.kwh)}
              r={hover === i ? 8 : 4.5}
              fill={dotColor}
            >
              <title>{`${p.label}: ${num(p.kwh)} kWh (${p.kind})`}</title>
            </circle>
          )
        })}

        {view.map((p, i) => (
          i % Math.ceil(view.length / 8) === 0 ? (
            <text key={p.label + i} x={xOf(i)} y={H - 14} textAnchor="middle" fill="#475569" fontSize="11" fontWeight="600">
              {p.label.replace(' 20', " '")}
            </text>
          ) : null
        ))}
        <text x={(padL + W - padR) / 2} y={H - 2} textAnchor="middle" fill="#475569" fontSize="12" fontWeight="700">Month</text>
      </svg>
      <div className="chart-legend" style={{ fontSize: '13px', fontWeight: 600, display: 'flex', gap: '20px' }}>
        <span><i className="dot" style={{ background: '#2563EB', display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px' }} /> <b>2024 Historical (Blue)</b></span>
        <span><i className="dot" style={{ background: '#8B5CF6', display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px' }} /> <b>2025 Historical (Purple)</b></span>
        <span><i className="dot" style={{ background: '#10B981', display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px' }} /> <b>2026 Forecast (Green)</b></span>
      </div>
    </div>
  )
}

function niceStep(range: number, target: number) {
  const raw = range / target
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const f = raw / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nice * pow
}

type ScatterDatum = { label: string; x: number; y: number }

function RegressionScatter({
  id,
  data,
  a,
  b,
  title,
  xLabel,
  yLabel,
  xPad,
  caption,
}: {
  id: string
  data: ScatterDatum[]
  a: number | null
  b: number | null
  title: string
  xLabel: string
  yLabel: string
  xPad?: number
  caption: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 920
  const H = 380
  const padL = 78
  const padR = 24
  const padT = 40
  const padB = 56

  const hasLine = a !== null && b !== null && data.length >= 2

  const rawMinX = Math.min(...data.map(p => p.x))
  const rawMaxX = Math.max(...data.map(p => p.x))
  const pad = xPad ?? (rawMaxX - rawMinX) * 0.05
  const xStep = niceStep((rawMaxX - rawMinX + 2 * pad) || 1, 7)
  const xLo = Math.floor((rawMinX - pad) / xStep) * xStep
  const xHi = Math.ceil((rawMaxX + pad) / xStep) * xStep

  const lineY = (x: number) => (a as number) + (b as number) * x
  const allY = [...data.map(p => p.y), ...(hasLine ? [lineY(xLo), lineY(xHi)] : [])]
  const rawMinY = Math.min(...allY)
  const rawMaxY = Math.max(...allY)
  const yStep = niceStep((rawMaxY - rawMinY) || 1, 6)
  const minY = Math.floor((rawMinY - yStep * 0.3) / yStep) * yStep
  const maxY = Math.ceil((rawMaxY + yStep * 0.3) / yStep) * yStep

  const xOf = (x: number) => padL + ((x - xLo) / (xHi - xLo || 1)) * (W - padL - padR)
  const yOf = (v: number) => padT + (1 - (v - minY) / (maxY - minY || 1)) * (H - padT - padB)

  const yTicks: number[] = []
  for (let v = minY; v <= maxY + 1e-9; v += yStep) yTicks.push(v)
  const xTicks: number[] = []
  for (let v = xLo; v <= xHi + 1e-9; v += xStep) xTicks.push(v)

  const active = hover === null ? null : data[hover]
  const line = hasLine
    ? `M${xOf(xLo)},${yOf(lineY(xLo))} L${xOf(xHi)},${yOf(lineY(xHi))}`
    : ''

  return (
    <div className="chart-wrap">
      {active && (
        <div className="chart-tooltip" style={{ fontSize: '14px', padding: '10px 14px' }}>
          <b style={{ fontSize: '15px' }}>{active.label}</b><br />
          x = {num(active.x)}<br />
          Actual y = <b>{num(active.y)} kWh</b>
          {hasLine ? <><br />Line ŷ = <b>{num(lineY(active.x))} kWh</b></> : null}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        <defs>
          <clipPath id={id}>
            <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
          </clipPath>
        </defs>

        <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} fill="#FFFFFF" stroke="#CBD5E1" />
        {yTicks.map(v => (
          <g key={'y' + v}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="#E2E8F0" />
            <text x={padL - 10} y={yOf(v) + 4} textAnchor="end" fill="#334155" fontSize="12" fontWeight="600">{num(v)}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={'x' + v}>
            <line x1={xOf(v)} x2={xOf(v)} y1={padT} y2={H - padB} stroke="#E2E8F0" />
            <text x={xOf(v)} y={H - padB + 18} textAnchor="middle" fill="#334155" fontSize="12" fontWeight="600">{num(v)}</text>
          </g>
        ))}

        <text x={W / 2} y={24} textAnchor="middle" fill="#0F172A" fontSize="16" fontWeight="700">{title}</text>
        <text x={(padL + W - padR) / 2} y={H - 10} textAnchor="middle" fill="#1E293B" fontSize="13" fontWeight="700">{xLabel}</text>
        <text
          transform={`translate(18 ${(padT + H - padB) / 2}) rotate(-90)`}
          textAnchor="middle" fill="#1E293B" fontSize="13" fontWeight="700"
        >
          {yLabel}
        </text>

        <g clipPath={`url(#${id})`}>
          {line && <path d={line} fill="none" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" />}
          {data.map((p, i) => (
            <circle
              key={p.label + i}
              cx={xOf(p.x)}
              cy={yOf(p.y)}
              r={hover === i ? 8 : 6}
              fill="#2563EB"
              fillOpacity="0.85"
              stroke="#1E40AF"
              strokeWidth="1.5"
              onMouseEnter={() => setHover(i)}
            >
              <title>{`${p.label} · x=${num(p.x)} · y=${num(p.y)} kWh`}</title>
            </circle>
          ))}
        </g>
      </svg>
      <div className="chart-legend" style={{ fontSize: '13px', fontWeight: 600 }}>
        <span><i className="dot actual" /> Actual data point</span>
        <span><i className="dot" style={{ background: '#EF4444' }} /> Linear regression line, ŷ = a + bx</span>
      </div>
      <p className="explain" style={{ fontSize: '14px', lineHeight: '1.6' }}>{caption}</p>
    </div>
  )
}

export default function SeasonalForecast({
  history,
  forecast,
  regression,
  rate,
}: {
  history: MonthPoint[]
  forecast: ForecastPoint[]
  regression: Regression | null
  rate: number
}) {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number }>({ start: 0, end: (history.length + forecast.length) - 1 })
  const [searchText, setSearchText] = useState('')
  const [scatterPair, setScatterPair] = useState<'2024_2025' | '2025_2026' | '2024_2026'>('2024_2025')

  const points = useMemo<Plot[]>(() => {
    const hist = history.map((m, i) => ({
      label: m.label,
      kwh: m.kwh,
      kind: (m.year === 2024 ? '2024' : '2025') as Plot['kind'],
      x: i + 1,
    }))
    const fut = forecast.map((m, i) => ({
      label: m.label,
      kwh: m.kwh,
      kind: '2026 Forecast' as Plot['kind'],
      x: history.length + i + 1,
    }))
    return [...hist, ...fut]
  }, [history, forecast])

  const handleTextSearch = (val: string) => {
    setSearchText(val)
    if (!val.trim()) return

    const lower = val.toLowerCase()
    const parts = lower.split(/[-–to]+/).map(s => s.trim())

    if (parts.length === 2) {
      const startIdx = points.findIndex(p => p.label.toLowerCase().includes(parts[0]))
      const endIdx = points.findIndex(p => p.label.toLowerCase().includes(parts[1]))
      if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
        setSelectedRange({ start: startIdx, end: endIdx })
      }
    } else {
      const idx = points.findIndex(p => p.label.toLowerCase().includes(lower))
      if (idx !== -1) {
        setSelectedRange({ start: idx, end: idx })
      }
    }
  }

  const dynamicScatter = useMemo(() => {
    const m2024 = history.filter(m => m.year === 2024)
    const m2025 = history.filter(m => m.year === 2025)
    const m2026 = forecast

    const config = (() => {
      if (scatterPair === '2024_2025') {
        return {
          pairs: forecast
            .filter(m => m.kwh_2024 != null && m.kwh_2025 != null)
            .map(m => ({ label: m.label.replace(' 2026', ''), x: m.kwh_2024 as number, y: m.kwh_2025 as number })),
          title: 'Year-over-Year Month Matching (2024 vs 2025)',
          xLab: '2024 monthly kWh (x)',
          yLab: '2025 monthly kWh (y)',
          desc: 'Months high in 2024 were consistently high in 2025, creating a strong positive upward slope. This annual correlation serves as the baseline for the forecast.'
        }
      } else if (scatterPair === '2025_2026') {
        return {
          pairs: m2025.map((m25, i) => ({
            label: m25.label.replace(' 2025', ''),
            x: m25.kwh,
            y: m2026[i]?.kwh ?? m25.kwh,
          })),
          title: 'Seasonal Projection (2025 Baseline vs 2026 Forecast)',
          xLab: '2025 monthly kWh (x)',
          yLab: '2026 predicted kWh (y)',
          desc: 'Projects 2025 actual monthly performance against the 2026 seasonal prediction model.'
        }
      } else {
        return {
          pairs: m2024.map((m24, i) => ({
            label: m24.label.replace(' 2024', ''),
            x: m24.kwh,
            y: m2026[i]?.kwh ?? m24.kwh,
          })),
          title: 'Long-Range Projection (2024 Baseline vs 2026 Forecast)',
          xLab: '2024 monthly kWh (x)',
          yLab: '2026 predicted kWh (y)',
          desc: 'Compares initial 2024 historical consumption patterns directly with 2026 projected output.'
        }
      }
    })()

    const { pairs, title, xLab, yLab, desc } = config

    if (pairs.length < 2) return null
    const n = pairs.length
    const xm = pairs.reduce((s, p) => s + p.x, 0) / n
    const ym = pairs.reduce((s, p) => s + p.y, 0) / n
    const sxy = pairs.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0)
    const sxx = pairs.reduce((s, p) => s + (p.x - xm) ** 2, 0)
    const b = sxx ? sxy / sxx : 0
    const a = ym - b * xm
    const sst = pairs.reduce((s, p) => s + (p.y - ym) ** 2, 0)
    const ssr = pairs.reduce((s, p) => s + (p.y - (a + b * p.x)) ** 2, 0)
    const r2 = sst ? 1 - ssr / sst : 1

    return { pairs, a, b, r2, title, xLab, yLab, desc }
  }, [history, forecast, scatterPair])

  const peakHist = history.reduce((a, b) => (b.kwh > a.kwh ? b : a), history[0])
  const peakFc = forecast.reduce((a, b) => (b.kwh > a.kwh ? b : a), forecast[0])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* MODULE 1: HISTORICAL & FORECAST TREND */}
      <section className="panel" style={{ borderTop: '4px solid #10B981' }}>
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="tag" style={{ marginBottom: '8px', display: 'inline-block' }}>MODULE 1 · SEASONAL FORECAST</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>Historical consumption and 2026 forecast</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>Hourly readings rolled up to monthly kWh. Differentiated by year with distinct colors.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '320px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
              Type a month (e.g., Feb 2026) or range (e.g., Mar-Jun 2024):
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Type solo month or range..."
                value={searchText}
                onChange={e => handleTextSearch(e.target.value)}
                style={{
                  flex: 1,
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none',
                  color: '#1E293B'
                }}
              />
              <select
                aria-label="Select month or year range"
                onChange={e => {
                  if (!e.target.value) return
                  const [s, end] = e.target.value.split('-').map(Number)
                  setSelectedRange({ start: s, end })
                }}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1E293B',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="">📂 Select Month / Year...</option>
                <option value={`0-${points.length - 1}`}>📅 All Range (2024–2026)</option>
                
                <optgroup label="2024 (Blue)">
                  <option value="0-11">Full Year 2024</option>
                  {points.slice(0, 12).map((p, idx) => {
                    const isHot = p.label.startsWith('Mar') || p.label.startsWith('Apr') || p.label.startsWith('May')
                    const isBer = p.label.startsWith('Sep') || p.label.startsWith('Oct') || p.label.startsWith('Nov') || p.label.startsWith('Dec')
                    const tag = isHot ? ' 🔥 Peak Dry' : isBer ? ' ❄️ Peak BER' : ''
                    return <option key={p.label + idx} value={`${idx}-${idx}`}>{p.label} — {num(p.kwh)} kWh{tag}</option>
                  })}
                </optgroup>

                <optgroup label="2025 (Purple)">
                  <option value="12-23">Full Year 2025</option>
                  {points.slice(12, 24).map((p, idx) => {
                    const realIdx = idx + 12
                    const isHot = p.label.startsWith('Mar') || p.label.startsWith('Apr') || p.label.startsWith('May')
                    const isBer = p.label.startsWith('Sep') || p.label.startsWith('Oct') || p.label.startsWith('Nov') || p.label.startsWith('Dec')
                    const tag = isHot ? ' 🔥 Peak Dry' : isBer ? ' ❄️ Peak BER' : ''
                    return <option key={p.label + realIdx} value={`${realIdx}-${realIdx}`}>{p.label} — {num(p.kwh)} kWh{tag}</option>
                  })}
                </optgroup>

                <optgroup label="2026 Forecast (Green)">
                  <option value="24-35">Full Year 2026 Forecast</option>
                  {points.slice(24, 36).map((p, idx) => {
                    const realIdx = idx + 24
                    const isHot = p.label.startsWith('Mar') || p.label.startsWith('Apr') || p.label.startsWith('May')
                    const isBer = p.label.startsWith('Sep') || p.label.startsWith('Oct') || p.label.startsWith('Nov') || p.label.startsWith('Dec')
                    const tag = isHot ? ' 🔥 Peak Dry' : isBer ? ' ❄️ Peak BER' : ''
                    return <option key={p.label + realIdx} value={`${realIdx}-${realIdx}`}>{p.label} — {num(p.kwh)} kWh{tag}</option>
                  })}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {history.length >= 2 && forecast.length ? (
          <ZoomChart points={points} range={selectedRange} />
        ) : (
          <p className="muted">Need dated monthly history before a seasonal forecast can be drawn.</p>
        )}

        <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#334155', margin: 0 }}>
            📌 <b>Facility Manager Brief:</b> <b>2024 is colored Blue</b>, <b>2025 is Purple</b>, and the <b>2026 Forecast is Green</b>.{' '}
            {peakHist ? <>Highest historical month in this file: <b>{peakHist.label}</b> at <b>{num(peakHist.kwh)} kWh</b>.</> : ''}{' '}
            {peakFc ? <>Highest predicted month: <b>{peakFc.label}</b> at <b>{num(peakFc.kwh)} kWh</b>.</> : ''}{' '}
            Type solo months (e.g., <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>Feb 2026</code>) or ranges in the search box, or pick peak summer (🔥) and BER (❄️) months from the dropdown above.
          </p>
        </div>
      </section>

      <hr style={{ border: '0', height: '1px', background: '#CBD5E1', margin: '0 10px' }} />

      {/* MODULE 2: SCATTER MODELS & CORRELATIONS WITH YEAR-PAIR SELECTOR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="tag" style={{ marginBottom: '8px', display: 'inline-block' }}>MODULE 2 · REGRESSION SCATTER ANALYSIS</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Year-over-Year &amp; Predictive Correlation</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Compare Years (X vs Y):</label>
            <select
              aria-label="Select year pair for scatter graph"
              value={scatterPair}
              onChange={e => setScatterPair(e.target.value as '2024_2025' | '2025_2026' | '2024_2026')}
              style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1E293B',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <option value="2024_2025">2024 (x) vs 2025 (y) — Historical YoY</option>
              <option value="2025_2026">2025 (x) vs 2026 Forecast (y) — Baseline vs Future</option>
              <option value="2024_2026">2024 (x) vs 2026 Forecast (y) — Long-range Baseline vs Future</option>
            </select>
          </div>
        </div>

        <section className="panel" style={{ borderLeft: '4px solid #2563EB' }}>
          <div className="panel-head">
            <div>
              <h2>{dynamicScatter?.title ?? 'Scatter Graph'}</h2>
              <p style={{ fontSize: '14px', color: '#475569' }}>Each dot is one calendar month. The red line is ŷ = a + bx.</p>
            </div>
            {dynamicScatter && (
              <span className="tag" style={{ fontSize: '13px', padding: '6px 12px' }}>
                r = <b>{Math.sqrt(Math.max(0, dynamicScatter.r2)).toFixed(2)}</b> · R² = <b>{dynamicScatter.r2.toFixed(3)}</b>
              </span>
            )}
          </div>
          {dynamicScatter ? (
            <RegressionScatter
              id={`scatter-clip-${scatterPair}`}
              data={dynamicScatter.pairs}
              a={dynamicScatter.a}
              b={dynamicScatter.b}
              title={dynamicScatter.title}
              xLabel={dynamicScatter.xLab}
              yLabel={dynamicScatter.yLab}
              caption={`${dynamicScatter.desc} (Slope b = ${dynamicScatter.b.toFixed(3)}, Intercept a = ${num(dynamicScatter.a)}).`}
            />
          ) : (
            <p className="muted">Needs sufficient matching monthly points for this pair selection.</p>
          )}
        </section>
      </div>

      <hr style={{ border: '0', height: '1px', background: '#CBD5E1', margin: '0 10px' }} />

      {/* MODULE 3: 2026 FORECAST TABLE */}
      <section className="panel" style={{ borderTop: '4px solid #3B82F6' }}>
        <div className="panel-head">
          <div>
            <span className="tag" style={{ marginBottom: '8px', display: 'inline-block' }}>MODULE 3 · FINANCIAL &amp; ENERGY PROJECTIONS</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>2026 forecast table</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>Predicted monthly kWh and estimated electricity cost in PHP at the current rate.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ fontSize: '14px' }}>Month</th>
                <th style={{ fontSize: '14px' }}>2024 kWh</th>
                <th style={{ fontSize: '14px' }}>2025 kWh</th>
                <th style={{ fontSize: '14px' }}>2026 predicted kWh</th>
                <th style={{ fontSize: '14px' }}>Estimated cost (PHP)</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map(m => (
                <tr key={m.label}>
                  <td style={{ fontWeight: 600 }}>{m.label}</td>
                  <td>{m.kwh_2024 == null ? '—' : num(m.kwh_2024)}</td>
                  <td>{m.kwh_2025 == null ? '—' : num(m.kwh_2025)}</td>
                  <td style={{ fontWeight: 700, color: '#10B981' }}>{num(m.kwh)}</td>
                  <td style={{ fontWeight: 700 }}>{money(m.kwh * rate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th style={{ fontSize: '15px' }}>2026 total</th>
                <th />
                <th />
                <th style={{ fontSize: '15px', color: '#10B981' }}>{num(forecast.reduce((s, m) => s + m.kwh, 0))} kWh</th>
                <th style={{ fontSize: '15px', color: '#0F172A' }}>{money(forecast.reduce((s, m) => s + m.kwh, 0) * rate)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#475569', margin: 0 }}>
            💡 <b>Billing Note:</b> Cost = predicted kWh × your configured PHP/kWh rate. This provides a robust budgeting estimate for facility operations based on actual historical consumption patterns.
          </p>
        </div>
      </section>

      <hr style={{ border: '0', height: '1px', background: '#CBD5E1', margin: '0 10px' }} />

      {/* MODULE 4: LINEAR REGRESSION CLASS WORKSHEET */}
      <section className="panel" style={{ borderTop: '4px solid #8B5CF6' }}>
        <div className="panel-head">
          <div>
            <span className="tag" style={{ marginBottom: '8px', display: 'inline-block' }}>MODULE 4 · ACADEMIC COMPUTATION WORKSHEET</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>Linear regression (class method) — all monthly points</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
              y = dependent variable (kWh) · x = independent variable (month index) · a = intercept · b = slope. Computed using all monthly totals.
            </p>
          </div>
        </div>
        {regression ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="metric-row" style={{ background: '#F1F5F9', padding: '16px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '14px' }}>
              <span>n: <b style={{ color: '#0F172A' }}>{regression.n}</b></span>
              <span>x̄: <b style={{ color: '#0F172A' }}>{num(regression.x_mean)}</b></span>
              <span>ȳ: <b style={{ color: '#0F172A' }}>{num(regression.y_mean)}</b></span>
              <span>Slope b: <b style={{ color: '#2563EB' }}>{num(regression.b)}</b></span>
              <span>Intercept a: <b style={{ color: '#2563EB' }}>{num(regression.a)}</b></span>
              <span>R²: <b style={{ color: '#10B981' }}>{regression.r2.toFixed(3)}</b></span>
            </div>
            <div className="formula" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '16px 20px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.7', color: '#1E3A8A' }}>
              <b>Formulas &amp; Computed Values:</b><br />
              b = &Sigma;(x &minus; x&#772;)(y &minus; y&#772;) / &Sigma;(x &minus; x&#772;)&sup2; = <b>{num(regression.b)}</b><br />
              a = y&#772; &minus; b &middot; x&#772; = <b>{num(regression.a)}</b><br />
              Predicted y = a + b &middot; x
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {['Month', 'x', 'y', 'x−x̄', 'y−ȳ', '(x−x̄)(y−ȳ)', '(x−x̄)²', 'Predicted y'].map(h => (
                      <th key={h} style={{ fontSize: '13px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {regression.rows.map(r => (
                    <tr key={r.x}>
                      <td style={{ fontWeight: 600 }}>{r.label}</td>
                      <td>{r.x}</td>
                      <td>{num(r.y)}</td>
                      <td>{num(r.dx)}</td>
                      <td>{num(r.dy)}</td>
                      <td>{num(r.product)}</td>
                      <td>{num(r.square)}</td>
                      <td style={{ fontWeight: 700, color: '#2563EB' }}>{num(r.predicted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="explain" style={{ fontSize: '14px', lineHeight: '1.6' }}>
              {regression.note} A straight line cannot capture distinct seasonal peaks (such as hot summer months vs. year-end humidity). Use the green seasonal forecast model for operational facility planning, and use this table for academic coursework requirements.
            </p>
          </div>
        ) : (
          <p className="muted">At least two monthly totals are required.</p>
        )}
      </section>
    </div>
  )
}