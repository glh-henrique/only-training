import * as React from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

// ponytail: arrasta >120px (ou flick rápido) pra fechar; senão volta. Ajustar se o gesto ficar sensível demais.
const CLOSE_DRAG_PX = 120

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [entered, setEntered] = React.useState(false)
  const [closing, setClosing] = React.useState(false)
  const [dragY, setDragY] = React.useState(0)
  const drag = React.useRef({ startY: 0, startT: 0, active: false })

  const requestClose = React.useCallback(() => setClosing(true), [])

  // Slide-in ao abrir; reseta estado.
  React.useEffect(() => {
    if (!isOpen) return
    setClosing(false); setDragY(0); setEntered(false)
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  // Fecha de fato só quando a animação de saída termina.
  const onSheetTransitionEnd = (e: React.TransitionEvent) => {
    if (closing && e.propertyName === 'transform') onClose()
  }

  // Escape fecha com animação.
  React.useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, requestClose])

  if (!isOpen) return null

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, startT: Date.now(), active: true }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    const dy = e.clientY - drag.current.startY
    setDragY(dy > 0 ? dy : 0) // só arrasta pra baixo
  }
  const onPointerUp = () => {
    if (!drag.current.active) return
    drag.current.active = false
    const dt = Date.now() - drag.current.startT
    const velocity = dragY / Math.max(dt, 1) // px/ms
    if (dragY > CLOSE_DRAG_PX || velocity > 0.6) requestClose()
    else setDragY(0)
  }

  const translateY = closing ? '100%' : entered ? `${dragY}px` : '100%'
  const sheetTransition = drag.current.active ? 'none' : 'transform 0.28s cubic-bezier(0.32,0.72,0,1)'
  const backdropVisible = entered && !closing

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{
        background: 'rgba(14,14,16,0.6)', backdropFilter: 'blur(8px)',
        opacity: backdropVisible ? 1 : 0, transition: 'opacity 0.28s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose() }}
    >
      <div
        className="w-full max-w-sm"
        onTransitionEnd={onSheetTransitionEnd}
        style={{
          background: '#ffffff',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 env(safe-area-inset-bottom,16px)',
          transform: `translateY(${translateY})`,
          transition: sheetTransition,
        }}
      >
        {/* Drag zone: alça + header (não pega o body p/ não atrapalhar inputs/scroll) */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: 'none', cursor: 'grab' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full" style={{ background: '#e0e0e4' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 pt-2">
            <h2 className="font-display text-[22px] font-extrabold uppercase leading-none" style={{ color: '#0e0e10' }}>
              {title}
            </h2>
            <button
              type="button"
              onClick={requestClose}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{ background: '#f0f0f3' }}
            >
              <X className="h-4 w-4" style={{ color: '#6a6a72' }} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#f0f0f3', marginLeft: 20, marginRight: 20 }} />

        {/* Body */}
        <div className="px-5 py-5 font-ui" style={{ color: '#0e0e10' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
