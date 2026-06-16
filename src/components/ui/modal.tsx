import * as React from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(14,14,16,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-200 sm:slide-in-from-bottom-0"
        style={{
          background: '#ffffff',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 env(safe-area-inset-bottom,16px)',
        }}
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
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ background: '#f0f0f3' }}
          >
            <X className="h-4 w-4" style={{ color: '#6a6a72' }} />
          </button>
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
