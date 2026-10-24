// One value per day from the summary's daily list (null values are allowed).
export function dailySeries(daily, key) {
  return (daily || []).map((day) => day[key])
}

// SVG polyline points for a sparkline. Empty string when fewer than two
// numeric values. Null values are skipped but keep their x position.
export function sparklinePoints(values, width = 100, height = 28, pad = 2) {
  const list = values || []
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
  const finite = list.filter(isNum)
  if (finite.length < 2) return ''
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min
  const innerWidth = width - pad * 2
  const innerHeight = height - pad * 2
  const step = innerWidth / (list.length - 1)
  const points = []
  list.forEach((value, index) => {
    if (!isNum(value)) return
    const x = pad + index * step
    const y = span === 0 ? height / 2 : pad + innerHeight - ((value - min) / span) * innerHeight
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  })
  return points.join(' ')
}
