// Gráfica de barras en SVG: soporta series pareadas (actual vs anterior)
export default function BarChart({ data, height = 260 }) {
  if (!data || data.length === 0) {
    return <p className="empty">Sin datos para mostrar</p>
  }

  const hasPrev = data.some((d) => d.previous != null && d.previous > 0)
  const allValues = data.flatMap((d) => [d.current ?? 0, d.previous ?? 0])
  const max = Math.max(...allValues, 1)
  const W = 760
  const H = height
  const padL = 8
  const padR = 8
  const padT = 18
  const padB = 26
  const n = data.length
  const band = (W - padL - padR) / n
  const barW = Math.min(band * 0.62, hasPrev ? 32 : 42)
  const niceMax = niceCeil(max)
  const grid = 4
  const plotH = H - padT - padB
  const y = (v) => padT + plotH * (1 - v / niceMax)
  const barHeight = (v) => Math.max(0, plotH - (y(v) - padT))

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: grid + 1 }, (_, i) => {
          const val = (niceMax / grid) * i
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(val)} y2={y(val)} className="chart-grid" />
              <text x={padL + 2} y={y(val) - 4} className="chart-axis">
                {formatAxisLabel(val)}
              </text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const cx = padL + band * i + band / 2
          const cur = d.current ?? 0
          return (
            <g key={i}>
              {hasPrev && (
                <rect
                  x={cx - barW - 2}
                  y={y(d.previous ?? 0)}
                  width={barW}
                  height={barHeight(d.previous ?? 0)}
                  rx={3}
                  className="bar bar-prev"
                >
                  <title>{`${d.label}: anterior ${formatAxisLabel(d.previous ?? 0)}`}</title>
                </rect>
              )}
              <rect
                x={cx - (hasPrev ? 2 : barW / 2)}
                y={y(cur)}
                width={barW}
                height={barHeight(cur)}
                rx={3}
                className="bar bar-cur"
              >
                <title>{`${d.label}: ${formatAxisLabel(cur)}`}</title>
              </rect>
              <text x={cx} y={H - 8} textAnchor="middle" className="chart-xlabel">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      {hasPrev && (
        <div className="chart-legend">
          <span><i className="dot dot-cur" /> Período actual</span>
          <span><i className="dot dot-prev" /> Período anterior</span>
        </div>
      )}
    </div>
  )
}

function formatAxisLabel(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`
  if (v >= 1_000) return `${(v / 1_000).toLocaleString('es-CO', { maximumFractionDigits: 0 })}k`
  return String(v)
}

function niceCeil(v) {
  if (v <= 0) return 1
  const exp = Math.floor(Math.log10(v))
  const base = Math.pow(10, exp)
  const frac = v / base
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10
  return nice * base
}