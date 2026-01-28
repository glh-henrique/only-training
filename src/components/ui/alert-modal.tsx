import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"
import { Modal } from "./modal"
import { Button } from "./button"
import { cn } from "../../lib/utils"

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

export function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  variant = 'info',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar'
}: AlertModalProps) {
  
  const iconMap = {
    info: <Info className="h-6 w-6 text-blue-500" />,
    success: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
    warning: <TriangleAlert className="h-6 w-6 text-amber-500" />,
    danger: <AlertCircle className="h-6 w-6 text-red-500" />
  }

  const colorMap = {
    info: "bg-blue-500/10",
    success: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    danger: "bg-red-500/10"
  }

  const confirmBtnColor = {
    info: "bg-blue-600 hover:bg-blue-700",
    success: "bg-emerald-600 hover:bg-emerald-700",
    warning: "bg-amber-600 hover:bg-amber-700",
    danger: "bg-red-600 hover:bg-red-700"
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-2xl shrink-0", colorMap[variant])}>
            {iconMap[variant]}
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed pt-1">
            {description}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            className="flex-1 border-neutral-200 dark:border-neutral-800" 
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button 
              className={cn("flex-1 text-white shadow-lg", confirmBtnColor[variant])}
              onClick={() => {
                onConfirm()
                onClose()
              }}
            >
              {confirmLabel}
            </Button>
          )}
          {!onConfirm && (
             <Button 
                className={cn("flex-1 text-white shadow-lg", confirmBtnColor[variant])}
                onClick={onClose}
             >
               Ok
             </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
