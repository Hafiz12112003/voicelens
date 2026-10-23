// Temporary foundation check. Replaced by the real shell in the next steps.
const swatches = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['raised', 'bg-raised'],
  ['accent', 'bg-accent'],
  ['accent-soft', 'bg-accent-soft'],
  ['high', 'bg-high'],
  ['medium', 'bg-medium'],
  ['low', 'bg-low'],
  ['success', 'bg-success'],
]

export default function App() {
  return (
    <main className="mx-auto max-w-[1280px] p-6">
      <div className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-xl font-semibold">VoiceLens</h1>
        <p className="mt-2 text-base text-muted">
          Foundation check: tokens, type scale, mono and number styles, focus ring.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-4 md:grid-cols-5 xl:grid-cols-9">
          {swatches.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`h-12 rounded-ctl border border-border-strong ${cls}`} />
              <span className="text-xs text-muted">{name}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <span className="text-xs">12 Caption text</span>
          <span className="text-sm">13 Secondary text</span>
          <span className="text-base">14 Body text</span>
          <span className="text-md">16 Emphasis text</span>
          <span className="text-lg">20 Section title</span>
          <span className="text-xl">28 Page title</span>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <span className="mono text-sm text-muted">restaurant-017</span>
          <span className="mono text-sm text-muted">00:04.3</span>
          <span className="num mono w-16 text-sm">1,820 ms</span>
          <button
            type="button"
            className="h-8 rounded-ctl border border-border-strong bg-raised px-4 text-sm transition-colors duration-(--dur) ease-(--ease) hover:bg-accent-soft"
          >
            Focus me with Tab
          </button>
        </div>
      </div>
    </main>
  )
}
