import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

declare const __APP_VERSION__: string

const FEATURES = [
  { icon: '⚡', labelKey: 'about.feat_sessions' },
  { icon: '📋', labelKey: 'about.feat_plans' },
  { icon: '📈', labelKey: 'about.feat_history' },
  { icon: '🤝', labelKey: 'about.feat_coach' },
]

export default function About() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const appVersion = __APP_VERSION__

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f2', color: '#0e0e10', paddingBottom: 80, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 22px 0' }}>
        <button type="button" onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ArrowLeft className="h-5 w-5" style={{ color: '#6a6a72' }} />
        </button>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: '#9a9aa2' }}>
          {t('about.title', 'SOBRE O APP').toUpperCase()}
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* Hero */}
      <div style={{ padding: '32px 22px 0' }}>
        {/* Logo mark */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: '#0e0e10',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <span style={{
            fontFamily: "'Saira Condensed', sans-serif",
            fontWeight: 900, fontSize: 28, letterSpacing: '-0.02em', color: '#d8ff36',
          }}>OT</span>
        </div>

        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: '#9a9aa2', marginBottom: 6 }}>
          {t('about.version', { version: appVersion })}
        </div>
        <h1 style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 900, fontSize: 54, lineHeight: 0.88, letterSpacing: '-0.01em', textTransform: 'uppercase', margin: 0 }}>
          Only<br />Training
        </h1>
      </div>

      {/* Description card */}
      <div style={{ margin: '28px 22px 0', background: '#fff', border: '1px solid #e9e9ee', borderRadius: 20, padding: '20px 18px' }}>
        <p style={{ fontFamily: "'Archivo', sans-serif", fontSize: 15, lineHeight: 1.65, color: '#4a4a52', margin: 0 }}>
          {t('about.description')}
        </p>
      </div>

      {/* Features */}
      <div style={{ padding: '24px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {FEATURES.map(({ icon, labelKey }) => (
          <div key={labelKey} style={{ background: '#fff', border: '1px solid #e9e9ee', borderRadius: 16, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 16, lineHeight: 1.1, textTransform: 'uppercase', color: '#0e0e10' }}>
              {t(labelKey, labelKey)}
            </span>
          </div>
        ))}
      </div>

      {/* Divider label */}
      <div style={{ padding: '28px 22px 0' }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: '#9a9aa2', marginBottom: 14 }}>
          {t('about.tech_label', 'TECNOLOGIA').toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['React 18', 'TypeScript', 'Supabase', 'Tailwind v4', 'Vite', 'PWA'].map(tech => (
            <span key={tech} style={{
              fontFamily: "'Space Mono', monospace", fontSize: 11,
              background: '#0e0e10', color: '#d8ff36',
              borderRadius: 6, padding: '5px 10px',
            }}>
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Footer line */}
      <div style={{ padding: '36px 22px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: '#e9e9ee' }} />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#c0c0c8', letterSpacing: '0.14em' }}>
          ONLY TRAINING © {new Date().getFullYear()}
        </span>
        <div style={{ flex: 1, height: 1, background: '#e9e9ee' }} />
      </div>
    </div>
  )
}
