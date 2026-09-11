import { computeNatalChart } from '@/lib/astrology'
import { AuraStyle, renderNatalChartSvg } from '@/lib/chartImage'

export const dynamic = 'force-dynamic'

const sampleChart = computeNatalChart({
  birthDate: '1996-03-03',
  birthTime: '04:15:00',
  timezone: 'Asia/Kolkata',
  latitude: 28.6139,
  longitude: 77.209,
  birthTimeKnown: true,
  birthTimeAccuracy: 'exact',
})

const moods: Array<{ style: AuraStyle; name: string; description: string }> = [
  { style: 'midnight', name: 'Midnight aura', description: 'Quiet, dark, and expensive. The current default.' },
  { style: 'prism', name: 'Prism aura', description: 'Brighter aurora and a more iridescent, digital glow.' },
  { style: 'velvet', name: 'Velvet aura', description: 'Warmer black-plum ground with softer, romantic light.' },
]

function withoutXmlDeclaration(svg: string): string {
  return svg.replace(/^<\?xml[^>]*>\s*/, '')
}

export default function ChartLabPage() {
  const cards = moods.map(mood => ({
    ...mood,
    svg: renderNatalChartSvg(sampleChart, { name: 'Sample' }, { auraStyle: mood.style }),
  }))
  const full = renderNatalChartSvg(sampleChart, {
    name: 'Sample',
    birthDate: '1996-03-03',
    birthTime: '04:15:00',
    birthTimeKnown: true,
    birthCity: 'New Delhi',
  }, { layout: 'full' })

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>PINCH / CHART LAB</div>
          <h1 style={styles.title}>Aura Seal directions</h1>
          <p style={styles.subtitle}>The same calculated chart in every frame. Only the visual mood changes.</p>
        </div>
        <a href="/test" style={styles.link}>back to test console</a>
      </div>

      <section style={styles.grid}>
        {cards.map(card => (
          <article key={card.style} style={styles.card}>
            <div
              style={styles.preview}
              dangerouslySetInnerHTML={{ __html: withoutXmlDeclaration(card.svg) }}
            />
            <h2 style={styles.cardTitle}>{card.name}</h2>
            <p style={styles.cardDescription}>{card.description}</p>
          </article>
        ))}
      </section>

      <section style={styles.fullSection}>
        <div style={styles.fullCopy}>
          <div style={styles.eyebrow}>FULL DETAIL FALLBACK</div>
          <h2 style={styles.fullTitle}>The technical chart still exists.</h2>
          <p style={styles.subtitle}>It is available on request instead of being forced into every phone preview.</p>
        </div>
        <div
          style={styles.fullPreview}
          dangerouslySetInnerHTML={{ __html: withoutXmlDeclaration(full) }}
        />
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '52px clamp(22px, 5vw, 72px) 80px',
    background: '#07070b',
    color: '#f7f4ff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    maxWidth: 1440,
    margin: '0 auto 38px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 24,
    flexWrap: 'wrap',
  },
  eyebrow: { color: '#9f92ff', fontSize: 12, letterSpacing: 3.4, fontWeight: 700 },
  title: { margin: '10px 0 8px', fontSize: 'clamp(34px, 5vw, 62px)', letterSpacing: -2 },
  subtitle: { margin: 0, color: '#9d99a8', fontSize: 16, lineHeight: 1.5, maxWidth: 640 },
  link: { color: '#d7d1ff', textDecoration: 'none', borderBottom: '1px solid #524c70', paddingBottom: 4 },
  grid: {
    maxWidth: 1440,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))',
    gap: 24,
  },
  card: { padding: 14, border: '1px solid #24232d', borderRadius: 26, background: '#101016' },
  preview: { overflow: 'hidden', borderRadius: 18, lineHeight: 0, boxShadow: '0 24px 70px rgba(0,0,0,.45)' },
  cardTitle: { margin: '19px 8px 7px', fontSize: 18 },
  cardDescription: { margin: '0 8px 10px', color: '#8f8b99', fontSize: 14, lineHeight: 1.45 },
  fullSection: {
    maxWidth: 980,
    margin: '86px auto 0',
    paddingTop: 42,
    borderTop: '1px solid #24232d',
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 480px)',
    alignItems: 'center',
    gap: 48,
  },
  fullCopy: { padding: 8 },
  fullTitle: { fontSize: 30, letterSpacing: -0.8, margin: '12px 0 10px' },
  fullPreview: { overflow: 'hidden', borderRadius: 20, lineHeight: 0, border: '1px solid #292833' },
}
