import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm")}>
      <div className={cn("bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200 text-neutral-900 dark:text-white")}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
