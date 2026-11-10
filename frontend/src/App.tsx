import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import DatasetUpload from './components/DatasetUpload'
import SeasonalForecast from './components/SeasonalForecast'
import type { ForecastPoint, MonthPoint, Regression } from './components/SeasonalForecast'

const API = 'http://127.0.0.1:8000'

type Point = {
  x: number
  date: string
  energy: number
}

type Analytics = {
  filename: string
  records: number
  energy_column: string
  date_column: string | null
  total_kwh: number
  average_kwh: number
  peak_kwh: number
  minimum_kwh: number
  peak_kw: number | null
  cost_php: number
  rate_php_per_kwh: number
  series: Point[]
  monthly: {
    month: string
    month_number: number
    kwh: number
  }[]
  appliances: {
    name: string
    kwh: number
    average_kw?: number | null
    peak_kw?: number | null
    peak_hour?: number | null
    hourly_profile?: { hour: number; average_kwh: number }[]
  }[]
  dates: {
    start: string | null
    end: string | null
  }
  monthly_history?: MonthPoint[]
  forecast_2026?: ForecastPoint[]
  yoy_change?: number | null
  regression?: Regression | null
}

const money = (n: number) =>
  '₱' + n.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const num = (n: number) =>
  n.toLocaleString('en-PH', {
    maximumFractionDigits: 2
  })

function Chart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const W = 900
  const H = 260
  const pad = 42

  const plotted = useMemo(() => {
    const step = Math.max(1, Math.ceil(data.length / 600))
    return data
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === data.length - 1)
  }, [data])

  const max = Math.max(1, ...plotted.map(({ d }) => d.energy))
  const min = Math.min(0, ...plotted.map(({ d }) => d.energy))

  const xy = (d: Point, i: number) => ({
    x: pad + (i / Math.max(1, plotted.length - 1)) * (W - pad * 2),
    y: H - pad - ((d.energy - min) / (max - min || 1)) * (H - pad * 2)
  })

  const path = plotted
    .map(({ d }, i) => {
      const q = xy(d, i)
      return `${i ? 'L' : 'M'}${q.x},${q.y}`
    })
    .join(' ')

  const active = hover === null ? null : plotted[hover] ?? null

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Energy consumption line chart">
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i}>
            <line
              x1={pad}
              x2={W - pad}
              y1={pad + i * (H - pad * 2) / 4}
              y2={pad + i * (H - pad * 2) / 4}
              stroke="#E2E8F0"
            />
            <text x="8" y={pad + i * (H - pad * 2) / 4 + 4} fill="#64748B" fontSize="11">
              {num(max - i * (max - min) / 4)}
            </text>
          </g>
        ))}

        <path d={path} fill="none" stroke="#10B981" strokeWidth="3" strokeLinejoin="round" />

        {plotted.map(({ d, i }, j) => {
          const q = xy(d, j)
          return (
            <circle
              key={i}
              cx={q.x}
              cy={q.y}
              r={hover === j ? 6 : 2.5}
              fill={hover === j ? '#EF4444' : '#14B8A6'}
              onMouseEnter={() => setHover(j)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${d.date}: ${num(d.energy)} kWh`}</title>
            </circle>
          )
        })}

        <text x={pad} y={H - 8} fill="#64748B" fontSize="11">
          {data[0]?.date ?? 'First record'}
        </text>
        <text x={W - pad} y={H - 8} textAnchor="end" fill="#64748B" fontSize="11">
          {data[data.length - 1]?.date ?? 'Last record'}
        </text>
      </svg>

      {active && (
        <div className="chart-tooltip">
          Record {active.i + 1} · {active.d.date}
          <br />
          <b>{num(active.d.energy)} kWh</b>
        </div>
      )}

      <p className="chart-caption">
        X-axis: timestamp / record sequence · Y-axis: energy consumption (kWh). Hover for exact values.
        {data.length > 600 ? ` Displaying ${plotted.length} representative points from ${data.length} records.` : ''}
      </p>
    </div>
  )
}

export default function App() {
  const [apiStatus, setApiStatus] = useState('Checking')
  const [page, setPage] = useState('Overview')
  const [filename, setFilename] = useState(localStorage.getItem('ep_dataset') || '')
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  const [rate, setRate] = useState(11)

  useEffect(() => {
    fetch(API + '/health')
      .then(r => setApiStatus(r.ok ? 'Connected' : 'Offline'))
      .catch(() => setApiStatus('Offline'))
  }, [])

  useEffect(() => {
    if (!filename) return
    let cancelled = false

    fetch(`${API}/api/datasets/${encodeURIComponent(filename)}/analytics`)
      .then(r => r.json().then(j => {
        if (!r.ok) throw Error(j.detail || 'Analytics failed')
        return j
      }))
      .then(d => {
        if (!cancelled) {
          setData(d)
          if (typeof d.rate_php_per_kwh === 'number' && d.rate_php_per_kwh > 0) {
            setRate(Number(d.rate_php_per_kwh.toFixed(4)))
          }
          setError('')
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e.message)
          setData(null)
        }
      })

    return () => { cancelled = true }
  }, [filename])

  const chooseDataset = (f: string) => {
    setFilename(f)
    localStorage.setItem('ep_dataset', f)
    setError('')
  }

  const handleDatasetDeleted = (deletedFilename: string) => {
    if (deletedFilename === filename) {
      setFilename('')
      localStorage.removeItem('ep_dataset')
      setData(null)
    }
  }

  const d = data
  const monthly = (d?.monthly_history?.length
    ? d.monthly_history.map(m => ({ month: m.label, month_number: m.month_number, kwh: m.kwh }))
    : d?.monthly) || []

  const peakMonth = monthly.reduce(
    (a, b) => b.kwh > a.kwh ? b : a,
    { month: '', month_number: 0, kwh: 0 }
  )

  const route = page.toLowerCase()
  const section =
    route.includes('dataset') ? 'dataset' :
    route === 'fc' || route.includes('forecast') ? 'forecast' :
    route === 'pl' || route.includes('plan') || route.includes('peak') ? 'planning' :
    route === 'rp' || route.includes('report') ? 'reports' :
    route === 'en' || route.includes('consumption') ? 'consumption' :
    'overview'

  const title =
    section === 'forecast' ? 'Forecasting' :
    section === 'planning' ? 'Peak-Load & Energy Planning' :
    section === 'reports' ? 'Reports & Summary' :
    section === 'consumption' ? 'Energy Consumption Analysis' :
    section === 'dataset' ? 'Dataset Management' :
    'System Overview'

  const cards = d ? [
    { label: 'Total Consumption', v: num(d.total_kwh) + ' kWh', c: 'blue', desc: 'Sum of valid energy records' },
    { label: 'Average Consumption', v: num(d.average_kwh) + ' kWh', c: 'green', desc: 'Mean energy per record' },
    { label: 'Peak Consumption', v: num(d.peak_kwh) + ' kWh', c: 'red', desc: 'Highest recorded energy value' },
    { label: 'Minimum Consumption', v: num(d.minimum_kwh) + ' kWh', c: 'teal', desc: 'Lowest recorded energy value' },
    { label: 'Records', v: num(d.records), c: 'purple', desc: 'Valid numeric observations' },
    { label: 'Estimated Cost', v: money(d.total_kwh * rate), c: 'orange', desc: `At ₱${rate.toFixed(2)}/kWh` }
  ] : []

  return (
    <div className="shell">
      <Sidebar activePage={page} onNavigate={setPage} />

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">ENERGY MONITORING & MANAGEMENT · SAAS DASHBOARD</p>
            <h1>{title}</h1>
            <p className="muted">
              EnergyPulse 2.0 · {d?.dates.start ? `${d.dates.start} — ${d.dates.end}` : 'Professional Energy Analytics Platform'}
            </p>
          </div>
          <span className={`status ${apiStatus === 'Connected' ? 'good' : 'bad'}`}>
            ● API {apiStatus}
          </span>
        </header>

        {section === 'dataset' ? (
          <DatasetUpload 
            onUploaded={chooseDataset} 
            onDeleted={handleDatasetDeleted}
            currentFilename={filename} 
          />
        ) : section === 'overview' ? (
          /* LITERAL SYSTEM OVERVIEW TAB */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <section className="panel" style={{ background: 'linear-gradient(135deg, #101B2D, #172A46)', color: '#FFFFFF', border: 'none', padding: '32px' }}>
              <span className="tag" style={{ background: '#2563EB', color: '#FFF', marginBottom: '12px', display: 'inline-block' }}>ENERGYPULSE 2.0 PLATFORM</span>
              <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>Welcome to EnergyPulse 2.0</h2>
              <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', maxWidth: '800px', margin: 0 }}>
                EnergyPulse 2.0 is an enterprise-grade energy monitoring and management SaaS platform engineered for commercial facilities, campuses, and industrial plants. It processes granular time-series data to optimize power distribution, forecast multi-year electricity trends, and mitigate high peak-load billing penalties.
              </p>
            </section>

            <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <section className="panel" style={{ borderTop: '4px solid #2563EB' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>🚀 Core Dashboard Modules</h3>
                <ul style={{ paddingLeft: '20px', color: '#475569', fontSize: '14px', lineHeight: '1.8', margin: 0 }}>
                  <li><b>Dataset Management:</b> Ingest, store, and switch between multi-gigabyte CSV datasets with automatic schema detection.</li>
                  <li><b>Energy Consumption:</b> Deep-dive into granular time-series graphs, monthly totals, and equipment sub-meter breakdowns.</li>
                  <li><b>Forecasting:</b> Project future electricity consumption using historical seasonal trends and regression models.</li>
                  <li><b>Peak-Load Analysis:</b> Identify peak power spikes and execute energy-saving action plans.</li>
                  <li><b>Reports &amp; Summary:</b> Export professional CSV breakdowns and print formatted PDF facility reports.</li>
                </ul>
              </section>

              <section className="panel" style={{ borderTop: '4px solid #10B981' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>📌 Quick Getting Started Guide</h3>
                <ol style={{ paddingLeft: '20px', color: '#475569', fontSize: '14px', lineHeight: '1.8', margin: 0 }}>
                  <li>Go to <b>Dataset Management</b> in the sidebar.</li>
                  <li>Upload your facility&apos;s CSV consumption file or select one from your repository table.</li>
                  <li>Once active, navigate to <b>Energy Consumption</b> to inspect metrics, charts, and appliance sub-meters.</li>
                  <li>Explore forecasting and peak-load modules to generate cost reduction strategies.</li>
                </ol>
              </section>
            </div>
          </div>
        ) : !filename || !d ? (
          <section className="panel empty">
            <div className="empty-icon">⚡</div>
            <h2>No dataset selected</h2>
            <p className="muted">Upload a CSV dataset to activate EnergyPulse 2.0 analytics.</p>
            {error && <p className="error" style={{ color: '#EF4444' }}>{error}</p>}
            <button onClick={() => setPage('Dataset Management')}>Upload CSV dataset</button>
          </section>
        ) : (
          <>
            {section === 'consumption' && (
              <>
                <section className="cards">
                  {cards.map(x => (
                    <article className={`stat ${x.c}`} key={x.label}>
                      <span>{x.label}</span>
                      <strong>{x.v}</strong>
                      <small>{x.desc}</small>
                    </article>
                  ))}
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Consumption over time</h2>
                      <p className="muted">Actual readings from the uploaded CSV file</p>
                    </div>
                    <span className="tag">{d.records} points</span>
                  </div>
                  <Chart data={d.series} />
                  <p className="explain">
                    This view displays actual energy use record by record. Investigate sustained rises and repeated peak loads for potential scheduling efficiencies.
                  </p>
                </section>

                <div className="two">
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Monthly / seasonal consumption</h2>
                        <p className="muted">Monthly totals based on timestamps</p>
                      </div>
                    </div>
                    {monthly.length ? (
                      <div className="bars" style={{ height: '220px', alignItems: 'flex-end', paddingTop: '30px' }}>
                        {monthly.map(m => (
                          <div className="bar-item" key={m.month} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                            <div
                              className="bar-value"
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#64748B',
                                marginBottom: '6px',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}
                              title={`${m.month}: ${num(m.kwh)} kWh`}
                            >
                              {(m.kwh / 1000).toFixed(0)}k
                            </div>
                            <div
                              className="bar"
                              style={{
                                width: '100%',
                                maxHeight: '140px',
                                height: `${Math.max(6, (m.kwh / Math.max(...monthly.map(x => x.kwh))) * 140)}px`,
                                background: 'linear-gradient(180deg, #10B981, #14B8A6)',
                                borderRadius: '6px 6px 0 0',
                                transition: 'all 0.2s'
                              }}
                              title={`${m.month}: ${num(m.kwh)} kWh`}
                            />
                            <small style={{ fontSize: '10px', color: '#64748B', marginTop: '6px', display: 'block', textAlign: 'center' }}>
                              {m.month.split(' ')[0]}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No recognizable date column detected for monthly breakdowns.</p>
                    )}
                    <p className="explain">
                      {monthly.length ? `Highest observed month: ${peakMonth.month} (${num(peakMonth.kwh)} kWh).` : ''}
                    </p>
                  </section>

                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Appliance contribution</h2>
                        <p className="muted">Detected equipment *_kwh columns</p>
                      </div>
                    </div>
                    {d.appliances.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {d.appliances.slice(0, 6).map(a => {
                          const maxKwh = Math.max(1, ...d.appliances.map(x => x.kwh))
                          const percentage = Math.min(100, Math.max(2, (a.kwh / maxKwh) * 100))
                          return (
                            <div key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 600 }}>
                                <span style={{ color: '#1E293B' }}>{a.name}</span>
                                <span style={{ color: '#0F172A', fontWeight: 700 }}>{num(a.kwh)} kWh</span>
                              </div>
                              <div style={{ width: '100%', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${percentage}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #10B981 0%, #14B8A6 100%)',
                                    borderRadius: '9999px',
                                    transition: 'width 0.4s ease-in-out'
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="muted">No equipment specific columns detected.</p>
                    )}
                  </section>
                </div>
              </>
            )}

            {section === 'forecast' && (
              <SeasonalForecast
                history={d.monthly_history || []}
                forecast={d.forecast_2026 || []}
                regression={d.regression || null}
                rate={rate}
              />
            )}

            {section === 'planning' && (
              <>
                <section className="cards">
                  {cards.slice(1, 4).map(x => (
                    <article className={`stat ${x.c}`} key={x.label}>
                      <span>{x.label}</span>
                      <strong>{x.v}</strong>
                      <small>{x.desc}</small>
                    </article>
                  ))}
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Peak-Load Evidence &amp; Distribution</h2>
                      <p className="muted">Visual breakdown of top consumption periods to support energy planning.</p>
                    </div>
                    <span className="tag" style={{ background: '#FEF2F2', color: '#DC2626' }}>Peak Threshold: {num(d.peak_kwh)} kWh</span>
                  </div>

                  {monthly.length ? (
                    <div className="bars" style={{ height: '200px', alignItems: 'flex-end', paddingTop: '20px', marginBottom: '20px' }}>
                      {monthly.map(m => {
                        const isPeakMonth = m.kwh === Math.max(...monthly.map(x => x.kwh))
                        return (
                          <div className="bar-item" key={m.month} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                            <div className="bar-value" style={{ fontSize: '10px', fontWeight: 600, color: isPeakMonth ? '#DC2626' : '#64748B', marginBottom: '6px', textAlign: 'center' }}>
                              {(m.kwh / 1000).toFixed(0)}k
                            </div>
                            <div
                              className="bar"
                              style={{
                                width: '100%',
                                maxHeight: '120px',
                                height: `${Math.max(6, (m.kwh / Math.max(...monthly.map(x => x.kwh))) * 120)}px`,
                                background: isPeakMonth ? 'linear-gradient(180deg, #EF4444, #DC2626)' : 'linear-gradient(180deg, #3B82F6, #1D4ED8)',
                                borderRadius: '6px 6px 0 0'
                              }}
                              title={`${m.month}: ${num(m.kwh)} kWh`}
                            />
                            <small style={{ fontSize: '10px', color: '#64748B', marginTop: '6px', display: 'block', textAlign: 'center' }}>
                              {m.month.split(' ')[0]}
                            </small>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="panel" style={{ borderLeft: '4px solid #3B82F6' }}>
                  <h2>Energy-saving action plan</h2>
                  <p className="muted">Suggested priorities based on your measurements:</p>
                  <ol className="plan-list" style={{ paddingLeft: '20px', lineHeight: '1.7', color: 'var(--text-main)' }}>
                    <li><b>Peak control:</b> Review equipment schedules around highest recorded consumption ({num(d.peak_kwh)} kWh).</li>
                    <li><b>Baseline target:</b> Set a reduction target of 5% from average consumption ({num(d.average_kwh)} kWh/record); target baseline is <b>{num(d.average_kwh * 0.95)} kWh</b>.</li>
                    <li><b>Equipment review:</b> Prioritize heavy load equipment optimization.</li>
                  </ol>
                </section>
              </>
            )}

            {section === 'reports' && (
              <>
                <section className="panel" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                  <div>
                    <h2 style={{ color: '#0F172A', fontSize: '18px' }}>Download &amp; Print Report</h2>
                    <p className="muted" style={{ margin: 0 }}>Export CSV analytics or generate a formatted PDF report instantly.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      style={{ background: '#2563EB', color: '#FFF', fontWeight: 700, padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
                      onClick={() => {
                        try {
                          const lines = ['section,label,kwh,php']
                          monthly.forEach(m => lines.push(`historical,${m.month},${m.kwh},${(m.kwh * rate).toFixed(2)}`))
                          const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'energypulse-report.csv'
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          alert('Error generating CSV download. Please check dataset integrity.')
                        }
                      }}
                    >
                      📥 Download CSV
                    </button>
                    <button
                      type="button"
                      style={{ background: '#10B981', color: '#FFF', fontWeight: 700, padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}
                      onClick={() => window.print()}
                    >
                      🖨️ Print / PDF
                    </button>
                  </div>
                </section>

                <section className="panel">
                  <h2>Cost estimate &amp; Rate adjustment</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                      Electricity rate (₱/kWh)
                      <input
                        type="number"
                        min="0"
                        step=".01"
                        value={rate}
                        onChange={e => setRate(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </label>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 700, margin: '8px 0 0 0' }}>
                    Estimated Total Cost: <span style={{ color: 'var(--emerald)' }}>{money(d.total_kwh * rate)}</span>
                  </p>
                </section>
              </>
            )}
          </>
        )}

        <footer>
          EnergyPulse 2.0 · Professional Energy Analytics SaaS Platform
        </footer>
      </main>
    </div>
  )
}