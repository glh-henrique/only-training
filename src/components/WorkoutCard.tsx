import { Play, MoreVertical, Trophy, Edit2, Archive, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import type { Database } from '../types/database.types'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'
import type { WorkoutWithStats } from '../stores/useWorkoutStore'

type Workout = Database['public']['Tables']['workouts']['Row']

interface WorkoutCardProps {
  workout: WorkoutWithStats | Workout
  isActive?: boolean
}

import { useWorkoutStore } from '../stores/useWorkoutStore'
import { AlertModal } from './ui/alert-modal'

export function WorkoutCard({ workout, isActive }: WorkoutCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'archive' | 'delete' | null;
  }>({ isOpen: false, type: null })
  
  const menuRef = useRef<HTMLDivElement>(null)
  const archiveWorkout = useWorkoutStore(state => state.archiveWorkout)
  const deleteWorkout = useWorkoutStore(state => state.deleteWorkout)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Cast to check for completed_count safely
  const count = (workout as WorkoutWithStats).completed_count || 0

  return (
    <div className={cn(
      "bg-neutral-50 dark:bg-neutral-900 border rounded-xl p-4 flex items-center justify-between group transition-all",
       isActive 
        ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/10" 
        : "border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50"
    )}>
      <Link to={`/workout/${workout.id}`} className="flex-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-neutral-900 dark:text-white group-hover:text-emerald-500 transition-colors">{workout.name}</h3>
            {isActive && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="In Progress" />
            )}
          </div>
          <div className="flex gap-2 text-sm">
             <span className="text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full w-fit">
                {workout.focus}
             </span>
             {count > 0 && (
                 <span className="flex items-center gap-1 text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Trophy className="h-3 w-3" />
                    {count}
                 </span>
             )}
             {(workout as WorkoutWithStats).last_completed_at && (
                 <span className="text-neutral-500 text-xs flex items-center">
                    Last: {new Date((workout as WorkoutWithStats).last_completed_at!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                 </span>
             )}
          </div>
        </div>
      </Link>
      
      <div className="flex items-center gap-2 relative" ref={menuRef}>
        <Link to={`/workout/${workout.id}`}>
          <Button size="icon" className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md shadow-emerald-900/20">
            <Play className="h-4 w-4 ml-0.5" />
            <span className="sr-only">Start Workout</span>
          </Button>
        </Link>
        
        <div className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-8 w-8 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors", showMenu && "text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800")}
            onClick={(e) => {
              e.preventDefault()
              setShowMenu(!showMenu)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>

          {showMenu && (
            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              <Link 
                to={`/workout/${workout.id}/edit`}
                className="flex items-center gap-2 w-full p-3 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                onClick={() => setShowMenu(false)}
              >
                <Edit2 className="h-4 w-4" />
                <span>Editar Treino</span>
              </Link>
              <button 
                className="flex items-center gap-2 w-full p-3 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                onClick={() => {
                  setModalConfig({ isOpen: true, type: 'archive' })
                  setShowMenu(false)
                }}
              >
                <Archive className="h-4 w-4 text-amber-500" />
                <span>Arquivar Treino</span>
              </button>
              <button 
                className="flex items-center gap-2 w-full p-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-t border-neutral-100 dark:border-neutral-700/50"
                onClick={() => {
                  setModalConfig({ isOpen: true, type: 'delete' })
                  setShowMenu(false)
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span>Excluir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, type: null })}
        onConfirm={() => {
          if (modalConfig.type === 'archive') archiveWorkout(workout.id)
          if (modalConfig.type === 'delete') deleteWorkout(workout.id)
        }}
        variant={modalConfig.type === 'delete' ? 'danger' : 'warning'}
        title={modalConfig.type === 'archive' ? 'Arquivar Treino?' : 'Excluir Treino?'}
        description={
          modalConfig.type === 'archive' 
            ? 'Este treino será movido para o arquivo e não aparecerá mais na Home. Você pode restaurá-lo depois.' 
            : 'Esta ação não pode ser desfeita. O treino e seu histórico de itens serão removidos permanentemente.'
        }
        confirmLabel={modalConfig.type === 'archive' ? 'Arquivar' : 'Excluir'}
      />
    </div>
  )
}
