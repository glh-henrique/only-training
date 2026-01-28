import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { Button } from '../components/ui/button'
import { ArrowLeft, Inbox, RefreshCcw, Trash2 } from 'lucide-react'
import { AlertModal } from '../components/ui/alert-modal'
import { supabase } from '../lib/supabase'
import { useState } from 'react'
import type { WorkoutWithStats } from '../stores/useWorkoutStore'
import { Skeleton } from '../components/ui/skeleton'

export default function ArchivedWorkouts() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { unarchiveWorkout, deleteWorkout } = useWorkoutStore()
  const [archived, setArchived] = useState<WorkoutWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [unarchiveModal, setUnarchiveModal] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  })
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  })


  const fetchArchived = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('is_archived', true)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setArchived(data as WorkoutWithStats[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArchived()
  }, [])

  const handleUnarchive = async () => {
    if (!unarchiveModal.id) return
    await unarchiveWorkout(unarchiveModal.id)
    setArchived(prev => prev.filter(w => w.id !== unarchiveModal.id))
    setUnarchiveModal({ isOpen: false, id: null })
  }

  const handleDelete = async () => {
    if (!deleteModal.id) return
    await deleteWorkout(deleteModal.id)
    setArchived(prev => prev.filter(w => w.id !== deleteModal.id))
    setDeleteModal({ isOpen: false, id: null })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      {/* Header */}
      <header className="p-4 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-10 border-b border-neutral-200 dark:border-neutral-800">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('workouts.archived', 'Archive')}</h1>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto">
        <div className="flex flex-col gap-4">
          {loading ? (
             <div className="space-y-3">
               {[1, 2, 3].map(i => (
                 <div key={i} className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                 </div>
               ))}
             </div>
          ) : archived.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <div className="h-16 w-16 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center text-neutral-400">
                <Inbox className="h-8 w-8" />
              </div>
              <div>
                <p className="font-semibold text-lg">{t('workouts.archive_empty_title', 'Archive Empty')}</p>
                <p className="text-sm text-neutral-500">{t('workouts.archive_empty_desc', 'Your archived workouts will appear here.')}</p>
              </div>
            </div>
          ) : (
            archived.map(workout => (
              <div key={workout.id} className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white">{workout.name}</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">{workout.focus}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => setUnarchiveModal({ isOpen: true, id: workout.id })}
                    title={t('common.restore', 'Restore')}
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-red-500 hover:bg-red-500/10"
                    onClick={() => setDeleteModal({ isOpen: true, id: workout.id })}
                    title={t('common.delete', 'Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <AlertModal
        isOpen={unarchiveModal.isOpen}
        onClose={() => setUnarchiveModal({ isOpen: false, id: null })}
        onConfirm={handleUnarchive}
        variant="info"
        title={t('workouts.unarchive_title', 'Unarchive Workout?')}
        description={t('workouts.unarchive_desc', 'This workout will appear back in your main list on Home. Do you want to continue?')}
        confirmLabel={t('common.restore', 'Unarchive')}
      />

      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        variant="danger"
        title={t('workouts.delete_title', 'Delete Workout?')}
        description={t('workouts.delete_desc', 'This action will remove the workout and all its history permanently. This cannot be undone.')}
        confirmLabel={t('common.delete', 'Delete')}
      />
    </div>
  )
}
