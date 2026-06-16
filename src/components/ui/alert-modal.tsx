import { Modal } from './modal'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title: string
  description: string
  variant?: 'info' | 'success' | 'warning' | 'danger'
  confirmLabel?: string
  cancelLabel?: string
}

const ACCENT: Record<string, string> = {
  info:    '#2a5fff',
  success: '#16b85c',
  warning: '#f5a623',
  danger:  '#e5484d',
}

const ACCENT_BG: Record<string, string> = {
  info:    '#eef2ff',
  success: '#eafff0',
  warning: '#fff8ed',
  danger:  '#fff0f0',
}

const ICON: Record<string, string> = {
  info:    'ℹ',
  success: '✓',
  warning: '⚠',
  danger:  '!',
}

export function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  variant = 'info',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
}: AlertModalProps) {
  const accent = ACCENT[variant]
  const accentBg = ACCENT_BG[variant]
  const icon = ICON[variant]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        {/* Icon + description */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] font-display text-[18px] font-extrabold"
            style={{ background: accentBg, color: accent }}
          >
            {icon}
          </div>
          <p className="pt-1 font-ui text-sm leading-relaxed" style={{ color: '#6a6a72' }}>
            {description}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[13px] border py-3 font-display text-base font-bold uppercase transition-opacity"
            style={{ borderColor: '#e0e0e4', color: '#6a6a72' }}
          >
            {cancelLabel}
          </button>

          {onConfirm ? (
            <button
              type="button"
              onClick={() => { onConfirm(); onClose() }}
              className="flex-1 rounded-[13px] py-3 font-display text-base font-bold uppercase text-white transition-opacity"
              style={{ background: accent }}
            >
              {confirmLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[13px] py-3 font-display text-base font-bold uppercase text-white transition-opacity"
              style={{ background: accent }}
            >
              OK
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
