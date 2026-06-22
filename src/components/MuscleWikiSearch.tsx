import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Loader2, Play } from 'lucide-react'
import { Input } from './ui/input'
import { VideoModal } from './VideoModal'
import { cn } from '../lib/utils'
import { searchMuscleWikiExercises, type MuscleWikiExercise } from '../lib/muscleWiki'

interface MuscleWikiSearchProps {
  value: string
  onChange: (value: string) => void
  onSelect: (exercise: MuscleWikiExercise) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function MuscleWikiSearch({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  autoFocus,
}: MuscleWikiSearchProps) {
  const { t, i18n } = useTranslation()
  const [results, setResults] = useState<MuscleWikiExercise[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [videoExercise, setVideoExercise] = useState<MuscleWikiExercise | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const justSelected = useRef(false)

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false
      return
    }
    const term = value.trim()
    let cancelled = false

    const handle = setTimeout(async () => {
      if (term.length < 2) {
        if (!cancelled) {
          setResults([])
          setLoading(false)
        }
        return
      }
      if (!cancelled) setLoading(true)
      const found = await searchMuscleWikiExercises(term, i18n.language)
      if (cancelled) return
      setResults(found)
      setLoading(false)
      setOpen(true)
    }, 320)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [value, i18n.language])

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current)
    }
  }, [])

  const handleSelect = (exercise: MuscleWikiExercise) => {
    justSelected.current = true
    setOpen(false)
    setResults([])
    onSelect(exercise)
  }

  const showDropdown = open && (loading || results.length > 0)

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: '#9a9aa2' }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150)
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn('pl-10', className)}
          autoComplete="off"
        />
        {loading && (
          <Loader2
            className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
            style={{ color: '#2a5fff' }}
          />
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-[14px] bg-white dark:bg-ot-dark-card py-1.5 shadow-lg"
          style={{ border: '1px solid #e0e0e4' }}
        >
          {results.length === 0 && !loading && (
            <div className="px-4 py-3 font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
              {t('musclewiki.no_results', 'Nenhum exercício encontrado')}
            </div>
          )}
          {results.map((exercise) => (
            <div
              key={exercise.id}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#f5f5f2]"
            >
              <button
                type="button"
                // Prevent input blur from firing before the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(exercise)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-display text-[14px] font-bold leading-tight">
                  {exercise.name}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-ot-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: '#9a9aa2' }}>
                  {exercise.muscle && <span>{exercise.muscle}</span>}
                  {exercise.category && <span>· {exercise.category}</span>}
                </div>
              </button>
              {exercise.videoUrl && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setVideoExercise(exercise)}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors"
                  style={{ background: '#f0f0f3' }}
                  aria-label={t('common.watch_video')}
                >
                  <Play className="h-4 w-4" style={{ color: '#2a5fff' }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <VideoModal
        isOpen={!!videoExercise}
        onClose={() => setVideoExercise(null)}
        title={videoExercise?.name ?? ''}
        videoUrl={videoExercise?.videoUrl ?? null}
      />
    </div>
  )
}
