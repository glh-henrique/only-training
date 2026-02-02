import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ArrowLeft, Plus, Trash2, GripVertical, Edit2, Check, X, Video } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/skeleton'

export default function WorkoutEditor() {
  const { t } = useTranslation()
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const { 
    activeWorkoutItems,
    fetchWorkoutItems, 
    addWorkoutItem, 
    updateWorkoutItem,
    deleteWorkoutItem
  } = useWorkoutStore()
  
  const [workoutName, setWorkoutName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemReps, setNewItemReps] = useState('')
  const [newItemSets, setNewItemSets] = useState('')
  const [newItemRest, setNewItemRest] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [newItemVideoUrl, setNewItemVideoUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editSets, setEditSets] = useState('')
  const [editRest, setEditRest] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editVideoUrl, setEditVideoUrl] = useState('')

  useEffect(() => {
    if (workoutId) {
      Promise.all([
        fetchWorkoutItems(workoutId),
        supabase.from('workouts').select('name').eq('id', workoutId).single()
      ]).then(([_, { data }]) => {
        if (data) setWorkoutName(data.name)
        setInitialLoading(false)
      })
    }
  }, [workoutId, fetchWorkoutItems])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName || !workoutId) return
    
    setIsSubmitting(true)
    // Order index is length + 1
    await addWorkoutItem(
      workoutId, 
      newItemName, 
      activeWorkoutItems.length,
      newItemReps ? newItemReps : undefined,
      newItemSets ? parseInt(newItemSets) : undefined,
      newItemRest ? parseInt(newItemRest) : undefined,
      newItemNotes,
      newItemVideoUrl.trim() ? newItemVideoUrl.trim() : undefined
    )
    setNewItemName('')
    setNewItemReps('')
    setNewItemSets('')
    setNewItemRest('')
    setNewItemNotes('')
    setNewItemVideoUrl('')
    setIsSubmitting(false)
  }

  const startEditing = (item: any) => {
    setEditingId(item.id)
    setEditName(item.title)
    setEditReps(item.default_reps?.toString() || '')
    setEditSets(item.default_sets?.toString() || '')
    setEditRest(item.rest_seconds?.toString() || '')
    setEditNotes(item.notes || '')
    setEditVideoUrl(item.video_url || '')
  }

  const cancelEditing = () => {
    setEditingId(null)
  }

  const handleUpdateItem = async (itemId: string) => {
    await updateWorkoutItem(itemId, {
      title: editName,
      default_reps: editReps ? editReps : undefined,
      default_sets: editSets ? parseInt(editSets) : undefined,
      rest_seconds: editRest ? parseInt(editRest) : undefined,
      notes: editNotes,
      video_url: editVideoUrl.trim() ? editVideoUrl.trim() : undefined
    })
    setEditingId(null)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20 transition-colors">
      <header className="p-4 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-10 transition-colors">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-neutral-500 dark:text-neutral-400">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-bold text-lg">{t('editor.title', { name: workoutName })}</h1>
      </header>

      {initialLoading ? (
        <main className="p-4 space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                            <Skeleton className="h-5 w-5 rounded" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-3 w-40" />
                            </div>
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
        </main>
      ) : (
        <main className="p-4 space-y-6">
        <div className="space-y-2">
            <h2 className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">{t('editor.exercises')}</h2>
            <div className="space-y-2">
                {activeWorkoutItems.map((item) => (
                    <div key={item.id} className={cn(
                        "bg-neutral-50 dark:bg-neutral-900 rounded-lg border transition-all",
                        editingId === item.id ? "p-4 border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/5" : "p-3 border-neutral-200 dark:border-neutral-800"
                    )}>
                        {editingId === item.id ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.name')}</label>
                                        <Input 
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.sets')}</label>
                                        <Input 
                                            type="text"
                                            value={editSets}
                                            onChange={(e) => setEditSets(e.target.value)}
                                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.reps')}</label>
                                        <Input 
                                            type="text"
                                            value={editReps}
                                            onChange={(e) => setEditReps(e.target.value)}
                                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.rest_seconds')}</label>
                                        <Input 
                                            type="number"
                                            value={editRest}
                                            onChange={(e) => setEditRest(e.target.value)}
                                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.notes')}</label>
                                    <Input 
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.video_url')}</label>
                                    <Input 
                                        value={editVideoUrl}
                                        onChange={(e) => setEditVideoUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={cancelEditing} className="text-neutral-400">
                                        <X className="h-4 w-4 mr-1" /> {t('common.cancel')}
                                    </Button>
                                    <Button size="sm" onClick={() => handleUpdateItem(item.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                        <Check className="h-4 w-4 mr-1" /> {t('common.save')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <GripVertical className="h-5 w-5 text-neutral-600" />
                                <div className="flex-1">
                                  <span className="font-medium block">{item.title}</span>
                                   <div className="flex items-center gap-2">
                                     {item.default_sets && <span className="text-xs text-neutral-500 dark:text-neutral-400">{item.default_sets} {t('common.sets').toLowerCase()}</span>}
                                     {item.default_reps && <span className="text-xs text-neutral-500 dark:text-neutral-400">{item.default_reps} {t('common.reps').toLowerCase()}</span>}
                                     {item.rest_seconds != null && <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('common.rest').toLowerCase()}: {item.rest_seconds}s</span>}
                                     {item.notes && <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded italic">{t('common.notes')}: {item.notes}</span>}
                                     {item.video_url && (
                                        <a
                                          href={item.video_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={t('common.video_url')}
                                          className="inline-flex items-center justify-center h-6 w-6 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                        >
                                          <Video className="h-4 w-4" />
                                        </a>
                                     )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 h-8 w-8"
                                        onClick={() => startEditing(item)}
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="text-red-500 hover:text-red-400 hover:bg-red-950/30 h-8 w-8"
                                        onClick={() => deleteWorkoutItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {activeWorkoutItems.length === 0 && (
                    <p className="text-center text-neutral-500 py-8 italic">No exercises yet.</p>
                )}
            </div>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <form onSubmit={handleAddItem} className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500 px-1">{t('editor.add_exercise')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_2fr_2fr_auto] gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.name')}</label>
                        <Input 
                            placeholder={t('common.name')} 
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white h-12 md:h-10 text-base md:text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.sets')}</label>
                        <Input 
                            placeholder="3" 
                            type="number"
                            value={newItemSets}
                            onChange={(e) => setNewItemSets(e.target.value)}
                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white h-12 md:h-10 text-base md:text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.reps')}</label>
                        <Input 
                            placeholder="12 ou 15/14/13/12" 
                            type="text"
                            value={newItemReps}
                            onChange={(e) => setNewItemReps(e.target.value)}
                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white h-12 md:h-10 text-base md:text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.rest_seconds')}</label>
                        <Input 
                            placeholder="60" 
                            type="number"
                            value={newItemRest}
                            onChange={(e) => setNewItemRest(e.target.value)}
                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white h-12 md:h-10 text-base md:text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.notes')}</label>
                        <Input 
                            placeholder={t('common.notes')} 
                            value={newItemNotes}
                            onChange={(e) => setNewItemNotes(e.target.value)}
                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white h-12 md:h-10 text-base md:text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">{t('common.video_url')}</label>
                        <Input 
                            placeholder="https://..."
                            value={newItemVideoUrl}
                            onChange={(e) => setNewItemVideoUrl(e.target.value)}
                            className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white h-12 md:h-10 text-base md:text-sm"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <Button type="submit" size="lg" disabled={isSubmitting || !newItemName} className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 md:h-10 px-6 shadow-lg shadow-emerald-950/20 w-full md:w-auto">
                            <Plus className="h-5 w-5 md:h-4 md:w-4 mr-2" /> {t('common.add')}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
      </main>
      )}
    </div>
  )
}
