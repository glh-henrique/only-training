import { cn } from '../../lib/utils'

interface LoadingProps {
  className?: string
  fullPage?: boolean
  text?: string
}

export function Loading({ className, fullPage = false, text }: LoadingProps) {
  const content = (
    <div className={cn('flex flex-col items-center justify-center gap-5', className)}>
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        {/* Track */}
        <svg width="48" height="48" viewBox="0 0 48 48" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="24" cy="24" r="20" fill="none" stroke="#e9e9ee" strokeWidth="3.5" />
        </svg>
        {/* Spinning arc */}
        <svg width="48" height="48" viewBox="0 0 48 48" style={{ position: 'absolute', inset: 0, animation: 'ot-spin 0.9s linear infinite' }}>
          <circle
            cx="24" cy="24" r="20"
            fill="none" stroke="#0e0e10" strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="34 92"
            strokeDashoffset="0"
            transform="rotate(-90 24 24)"
          />
        </svg>
        {/* Lime dot */}
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 9, height: 9, borderRadius: '50%',
          background: '#d8ff36',
          border: '2px solid #f5f5f2',
        }} />
      </div>
      {text && (
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.18em', color: '#9a9aa2' }}>
          {text.toUpperCase()}
        </span>
      )}
      <style>{`@keyframes ot-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (fullPage) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f5f5f2',
      }}>
        {content}
      </div>
    )
  }

  return content
}
