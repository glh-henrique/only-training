import { Link, useLocation } from 'react-router-dom'

export function BottomNav() {
  const { pathname } = useLocation()
  const color = (p: string) => pathname === p ? '#2a5fff' : '#b3b3bb'

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 h-[76px] border-t border-[#ececf0] flex items-start justify-around px-5 pt-2.5"
      style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(20px)' }}>

      <Link to="/" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color('/')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-7 9 7" /><path d="M5 9.5V20h14V9.5" />
        </svg>
        <span className="font-ot-mono text-[8.5px] tracking-[0.04em]" style={{ color: color('/') }}>HOJE</span>
      </Link>

      <Link to="/workouts" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color('/workouts')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11" />
        </svg>
        <span className="font-ot-mono text-[8.5px] tracking-[0.04em]" style={{ color: color('/workouts') }}>TREINOS</span>
      </Link>

      <Link to="/history" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color('/history')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-5 4 3 6-7" /><path d="M3 21h18" />
        </svg>
        <span className="font-ot-mono text-[8.5px] tracking-[0.04em]" style={{ color: color('/history') }}>EVOLUÇÃO</span>
      </Link>

      <Link to="/profile" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color('/profile')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
        </svg>
        <span className="font-ot-mono text-[8.5px] tracking-[0.04em]" style={{ color: color('/profile') }}>PERFIL</span>
      </Link>
    </nav>
  )
}
