import { cn } from '../../lib/utils'

interface LoadingProps {
  className?: string
  fullPage?: boolean
  text?: string
}

export function Loading({ className, fullPage = false, text = 'Loading...' }: LoadingProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500", className)}>
      <div className="relative h-12 w-12">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
        {/* Spinning ring */}
        <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        {/* Inner pulse */}
        <div className="absolute inset-2 bg-emerald-500/20 rounded-full animate-pulse" />
      </div>
      {text && (
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-neutral-950">
        {content}
      </div>
    )
  }

  return content
}
