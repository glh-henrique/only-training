import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { Input } from '../components/ui/input'
import { GripVertical, Trash2, Video } from 'lucide-react'
import { cn, getSafeExternalUrl } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/skeleton'
import { useAuthStore } from '../stores/useAuthStore'
import { MuscleWikiSearch } from '../components/MuscleWikiSearch'
import { VideoModal } from '../components/VideoModal'
import type { MuscleWikiExercise } from '../lib/muscleWiki'
import { WORKOUT_DEFAULTS } from '../constants/defaults'

export default function WorkoutEditor() {
  const { t } = useTranslation()
  const { workoutId } = useParams()
  const [searchParams] = useSearchParams()
  const ownerUserId = searchParams.get('owner') || undefined
  const navigate = useNavigate()
  const {
    activeWorkoutItems,
    fetchWorkoutItems,
    addWorkoutItem,
    updateWorkoutItem,
    deleteWorkoutItem,
    reorderWorkoutItems,
    renameWorkout
  } = useWorkoutStore()
  const user = useAuthStore(state => state.user)

  const [workoutName, setWorkoutName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemType, setNewItemType] = useState<'strength' | 'cardio'>('strength')
  const [newItemDuration, setNewItemDuration] = useState('')
  const [newItemReps, setNewItemReps] = useState('')
  const [newItemSets, setNewItemSets] = useState('')
  const [newItemRest, setNewItemRest] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [newItemVideoUrl, setNewItemVideoUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRenamingWorkout, setIsRenamingWorkout] = useState(false)
  const [editingWorkoutName, setEditingWorkoutName] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newVideoSearch, setNewVideoSearch] = useState('')
  const [newVideoSearchOpen, setNewVideoSearchOpen] = useState(false)
  const [videoModalItem, setVideoModalItem] = useState<{ title: string; url: string } | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragItems, setDragItems] = useState<typeof activeWorkoutItems | null>(null)
  const liveItems = dragItems ?? activeWorkoutItems
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const prevRects = useRef(new Map<string, DOMRect>())

  // FLIP: anima cada item da posição antiga pra nova sempre que a ordem muda.
  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>()
    liveItems.forEach((item) => {
      const el = itemRefs.current.get(item.id)
      if (el) newRects.set(item.id, el.getBoundingClientRect())
    })
    newRects.forEach((newRect, id) => {
      const oldRect = prevRects.current.get(id)
      const el = itemRefs.current.get(id)
      if (!oldRect || !el) return
      const deltaY = oldRect.top - newRect.top
      if (!deltaY) return
      el.style.transition = 'none'
      el.style.transform = `translateY(${deltaY}px)`
      requestAnimationFrame(() => {
        el.style.transition = 'transform 200ms ease'
        el.style.transform = ''
      })
    })
    prevRects.current = newRects
  }, [liveItems])

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editItemType, setEditItemType] = useState<'strength' | 'cardio'>('strength')
  const [editDuration, setEditDuration] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editSets, setEditSets] = useState('')
  const [editRest, setEditRest] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editVideoUrl, setEditVideoUrl] = useState('')
  const [editVideoSearch, setEditVideoSearch] = useState('')
  const [editVideoSearchOpen, setEditVideoSearchOpen] = useState(false)

  const newVideoUrlInvalid = newItemVideoUrl.trim().length > 0 && !getSafeExternalUrl(newItemVideoUrl)
  const editVideoUrlInvalid = editVideoUrl.trim().length > 0 && !getSafeExternalUrl(editVideoUrl)

  useEffect(() => {
    if (workoutId && user) {
      const workoutNameQuery = supabase.from('workouts').select('name').eq('id', workoutId)
      const scopedWorkoutNameQuery = ownerUserId
        ? workoutNameQuery.eq('user_id', ownerUserId)
        : workoutNameQuery

      Promise.all([
        fetchWorkoutItems(workoutId, ownerUserId),
        scopedWorkoutNameQuery.single()
      ]).then(([, { data }]) => {
        if (data) {
          setWorkoutName(data.name)
          setEditingWorkoutName(data.name)
        }
        setInitialLoading(false)
      })
    }
  }, [workoutId, fetchWorkoutItems, user, ownerUserId])

  const handleRenameWorkout = async () => {
    if (!workoutId || !editingWorkoutName.trim() || editingWorkoutName === workoutName) {
      setIsRenamingWorkout(false)
      setEditingWorkoutName(workoutName)
      return
    }

    try {
      const newName = editingWorkoutName.trim()
      await renameWorkout(workoutId, newName, ownerUserId)
      setWorkoutName(newName)
      setIsRenamingWorkout(false)
    } catch (err) {
      console.error('Failed to rename workout', err)
      setEditingWorkoutName(workoutName)
      setIsRenamingWorkout(false)
    }
  }

  const handleAddItem = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!newItemName || !workoutId) return

    const isCardio = newItemType === 'cardio'
    setIsSubmitting(true)
    await addWorkoutItem(
      workoutId,
      newItemName,
      activeWorkoutItems.length,
      !isCardio && newItemReps ? newItemReps : undefined,
      !isCardio && newItemSets ? parseInt(newItemSets) : undefined,
      !isCardio && newItemRest ? parseInt(newItemRest) : undefined,
      newItemNotes,
      !isCardio && newItemVideoUrl.trim() ? newItemVideoUrl.trim() : undefined,
      ownerUserId,
      { item_type: newItemType, duration_minutes: isCardio && newItemDuration ? parseInt(newItemDuration) : null }
    )
    setNewItemName('')
    setNewItemType('strength')
    setNewItemDuration('')
    setNewItemReps('')
    setNewItemSets('')
    setNewItemRest('')
    setNewItemNotes('')
    setNewItemVideoUrl('')
    setNewVideoSearch('')
    setNewVideoSearchOpen(false)
    setIsSubmitting(false)
    setShowAddForm(false)
  }

  const handleNewExerciseSelect = (exercise: MuscleWikiExercise) => {
    setNewItemName(exercise.name)
    if (exercise.videoUrl) setNewItemVideoUrl(exercise.videoUrl)
  }

  const handleEditExerciseSelect = (exercise: MuscleWikiExercise) => {
    setEditName(exercise.name)
    if (exercise.videoUrl) setEditVideoUrl(exercise.videoUrl)
  }

  const startEditing = (item: { id: string; title: string; default_reps?: string | null; default_sets?: number | null; rest_seconds?: number | null; notes?: string | null; video_url?: string | null; item_type?: string; duration_minutes?: number | null }) => {
    setEditingId(item.id)
    setEditName(item.title)
    setEditItemType(item.item_type === 'cardio' ? 'cardio' : 'strength')
    setEditDuration(item.duration_minutes?.toString() || '')
    setEditReps(item.default_reps?.toString() || '')
    setEditSets(item.default_sets?.toString() || '')
    setEditRest(item.rest_seconds?.toString() || '')
    setEditNotes(item.notes || '')
    setEditVideoUrl(item.video_url || '')
    setEditVideoSearch('')
    setEditVideoSearchOpen(false)
  }

  const handleDragStart = (index: number) => {
    setDragItems(activeWorkoutItems)
    setDragIndex(index)
  }

  // Só troca com o vizinho imediato, e só quando o cursor passa do meio dele -
  // isso é o que dá a sensação de "empurrar" em vez de reordenar tudo de uma vez.
  const handleDragOverItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (dragIndex === null || !dragItems || Math.abs(targetIndex - dragIndex) !== 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    const movingDown = targetIndex > dragIndex
    const crossedMidpoint = movingDown ? e.clientY > midpoint : e.clientY < midpoint
    if (!crossedMidpoint) return
    const reordered = [...dragItems]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setDragItems(reordered)
    setDragIndex(targetIndex)
  }

  const handleDragEnd = () => {
    if (dragItems) reorderWorkoutItems(dragItems, ownerUserId)
    setDragItems(null)
    setDragIndex(null)
  }

  const handleUpdateItem = async (itemId: string) => {
    const isCardio = editItemType === 'cardio'
    await updateWorkoutItem(itemId, {
      title: editName,
      item_type: editItemType,
      duration_minutes: isCardio && editDuration ? parseInt(editDuration) : null,
      default_reps: !isCardio && editReps ? editReps : undefined,
      default_sets: !isCardio && editSets ? parseInt(editSets) : undefined,
      rest_seconds: !isCardio && editRest ? parseInt(editRest) : undefined,
      notes: editNotes,
      video_url: !isCardio && editVideoUrl.trim() ? editVideoUrl.trim() : undefined
    }, ownerUserId)
    setEditingId(null)
  }

  return (
    <div className="min-h-screen pb-28 font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--color-ot-header-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--color-ot-border)' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-colors"
          style={{ background: 'var(--color-ot-card)', border: '1px solid var(--color-ot-border)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9L11 14" stroke="var(--color-ot-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
            EDITOR DE TREINO
          </div>
          {isRenamingWorkout ? (
            <Input
              autoFocus
              value={editingWorkoutName}
              onChange={(e) => setEditingWorkoutName(e.target.value)}
              onBlur={handleRenameWorkout}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameWorkout()
                if (e.key === 'Escape') {
                  setEditingWorkoutName(workoutName)
                  setIsRenamingWorkout(false)
                }
              }}
              className="mt-1 h-8 font-display text-[20px] font-extrabold uppercase leading-none px-2"
            />
          ) : (
            <h1 
              className="font-display text-[20px] font-extrabold uppercase leading-none truncate cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
              onClick={() => setIsRenamingWorkout(true)}
              title={t('common.edit', 'Editar')}
            >
              {workoutName || '…'}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-none opacity-50">
                <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </h1>
          )}
        </div>
      </div>

      {initialLoading ? (
        <div className="px-5 pt-6 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-[20px] bg-white dark:bg-ot-dark-card p-4 flex items-center gap-3" style={{ border: '1px solid var(--color-ot-border)' }}>
              <Skeleton className="h-9 w-9 rounded-[11px]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 pt-6 space-y-3">

          {activeWorkoutItems.length === 0 && !showAddForm && (
            <div className="py-12 text-center">
              <div className="font-display text-[56px] font-extrabold leading-none" style={{ color: 'var(--color-ot-border)' }}>0</div>
              <p className="mt-2 font-ot-mono text-[10px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
                NENHUM EXERCÍCIO AINDA
              </p>
            </div>
          )}

          {liveItems.map((item, index) => {
            const safeVideoUrl = getSafeExternalUrl(item.video_url)
            const isEditing = editingId === item.id

            return (
              <div
                key={item.id}
                ref={(el) => { if (el) itemRefs.current.set(item.id, el); else itemRefs.current.delete(item.id) }}
                draggable={!isEditing}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOverItem(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => e.preventDefault()}
                className="rounded-[20px] bg-white dark:bg-ot-dark-card overflow-hidden"
                style={{
                  border: isEditing ? '1.5px solid var(--color-ot-blue)' : '1px solid var(--color-ot-border)',
                  boxShadow: isEditing ? '0 0 0 3px rgba(42,95,255,0.08)' : undefined,
                  opacity: dragIndex === index ? 0.4 : 1,
                }}
              >
                {isEditing ? (
                  <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                      {(['strength', 'cardio'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEditItemType(type)}
                          className="flex-1 rounded-[11px] border py-2 font-display text-[13px] font-bold uppercase transition-colors"
                          style={editItemType === type
                            ? { background: '#2a5fff', borderColor: '#2a5fff', color: '#fff' }
                            : { borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)', background: 'transparent' }}
                        >
                          {type === 'strength' ? t('editor.type_strength', 'Musculação') : t('editor.type_cardio', 'Cardio')}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                        {t('common.name')}
                      </label>
                      {editItemType === 'cardio' ? (
                        <Input
                          autoFocus
                          placeholder={t('editor.cardio_name_placeholder', 'Corrida, bike, natação...')}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        <MuscleWikiSearch
                          value={editName}
                          onChange={setEditName}
                          onSelect={handleEditExerciseSelect}
                          placeholder={t('musclewiki.search_placeholder', 'Buscar exercício...')}
                          autoFocus
                        />
                      )}
                    </div>

                    {editItemType === 'cardio' && (
                      <div className="space-y-1.5">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.duration_minutes', 'Duração (min)')}
                        </label>
                        <Input type="number" placeholder="15" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
                      </div>
                    )}

                    {editItemType !== 'cardio' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.sets')}
                        </label>
                        <Input type="number" placeholder={WORKOUT_DEFAULTS.SETS.toString()} value={editSets} onChange={(e) => setEditSets(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.reps')}
                        </label>
                        <Input type="text" placeholder={WORKOUT_DEFAULTS.REPS} value={editReps} onChange={(e) => setEditReps(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.rest_seconds')}
                        </label>
                        <Input type="number" placeholder={WORKOUT_DEFAULTS.REST_SECONDS.toString()} value={editRest} onChange={(e) => setEditRest(e.target.value)} />
                      </div>
                    </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                        {t('common.notes')}
                      </label>
                      <Input placeholder={t('common.notes')} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    </div>

                    {editItemType !== 'cardio' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.video_url')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditVideoSearchOpen((v) => !v)}
                          className="inline-flex items-center gap-1 font-ot-mono text-[9px] uppercase tracking-[0.1em]"
                          style={{ color: '#2a5fff' }}
                        >
                          <Video className="h-3 w-3" />
                          {t('musclewiki.search_video', 'Buscar na MuscleWiki')}
                        </button>
                      </div>
                      {editVideoSearchOpen && (
                        <MuscleWikiSearch
                          value={editVideoSearch}
                          onChange={setEditVideoSearch}
                          onSelect={(exercise) => {
                            if (exercise.videoUrl) setEditVideoUrl(exercise.videoUrl)
                            setEditVideoSearchOpen(false)
                          }}
                          placeholder={t('musclewiki.search_placeholder', 'Buscar exercício...')}
                        />
                      )}
                      <Input
                        placeholder="https://..."
                        value={editVideoUrl}
                        onChange={(e) => setEditVideoUrl(e.target.value)}
                        className={cn(editVideoUrlInvalid && 'border-ot-danger-text')}
                      />
                      {editVideoUrlInvalid && (
                        <p className="font-ot-mono text-[9px]" style={{ color: 'var(--color-ot-danger-text)' }}>
                          {t('common.video_url_invalid', 'Use http:// ou https://')}
                        </p>
                      )}
                    </div>
                    )}

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-[13px] border py-3 font-display text-[14px] font-bold uppercase transition-opacity"
                        style={{ borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)' }}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(item.id)}
                        disabled={!editName || editVideoUrlInvalid}
                        className="flex-1 rounded-[13px] py-3 font-display text-[14px] font-bold uppercase text-[#0e0e10] transition-opacity disabled:opacity-40"
                        style={{ background: '#d8ff36' }}
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <GripVertical className="h-5 w-5 flex-none cursor-grab active:cursor-grabbing" style={{ color: '#d0d0d8' }} />

                    <div
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] font-display text-[16px] font-extrabold"
                      style={{ background: 'var(--color-ot-accent-bg)', color: 'var(--color-ot-accent-text)' }}
                    >
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="block font-display text-[17px] font-bold leading-none truncate">
                        {item.title}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {item.item_type === 'cardio' && (
                          <span className="font-ot-mono text-[10px] font-bold uppercase" style={{ color: 'var(--color-ot-accent-text)' }}>
                            Cardio{item.duration_minutes != null ? ` · ${item.duration_minutes} min` : ''}
                          </span>
                        )}
                        {item.item_type !== 'cardio' && item.default_sets && (
                          <span className="font-ot-mono text-[10px]" style={{ color: 'var(--color-ot-muted)' }}>
                            {item.default_sets} {t('common.sets').toLowerCase()}
                          </span>
                        )}
                        {item.item_type !== 'cardio' && item.default_reps && (
                          <span className="font-ot-mono text-[10px]" style={{ color: 'var(--color-ot-muted)' }}>
                            × {item.default_reps}
                          </span>
                        )}
                        {item.item_type !== 'cardio' && item.rest_seconds != null && (
                          <span className="font-ot-mono text-[10px]" style={{ color: 'var(--color-ot-faint)' }}>
                            {item.rest_seconds}s {t('common.rest').toLowerCase()}
                          </span>
                        )}
                        {item.notes && (
                          <span className="font-ot-mono text-[10px] italic" style={{ color: 'var(--color-ot-faint)' }}>
                            {item.notes}
                          </span>
                        )}
                        {safeVideoUrl && (
                          <button
                            type="button"
                            onClick={() => setVideoModalItem({ title: item.title, url: safeVideoUrl })}
                            title={t('common.watch_video')}
                            className="inline-flex items-center justify-center"
                            style={{ color: '#2a5fff' }}
                          >
                            <Video className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-none">
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                        style={{ color: 'var(--color-ot-muted)' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWorkoutItem(item.id, ownerUserId)}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                        style={{ color: 'var(--color-ot-danger-text)' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Add exercise ── */}
          {showAddForm ? (
            <form
              onSubmit={handleAddItem}
              className="rounded-[20px] bg-white dark:bg-ot-dark-card p-4 space-y-4"
              style={{ border: '1.5px solid #2a5fff', boxShadow: '0 0 0 3px rgba(42,95,255,0.08)' }}
            >
              <div className="font-ot-mono text-[9px] tracking-[0.14em] uppercase font-bold" style={{ color: '#2a5fff' }}>
                {t('editor.add_exercise')}
              </div>

              <div className="flex gap-2">
                {(['strength', 'cardio'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewItemType(type)}
                    className="flex-1 rounded-[11px] border py-2 font-display text-[13px] font-bold uppercase transition-colors"
                    style={newItemType === type
                      ? { background: '#2a5fff', borderColor: '#2a5fff', color: '#fff' }
                      : { borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)', background: 'transparent' }}
                  >
                    {type === 'strength' ? t('editor.type_strength', 'Musculação') : t('editor.type_cardio', 'Cardio')}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                  {t('common.name')} *
                </label>
                {newItemType === 'cardio' ? (
                  <Input
                    autoFocus
                    placeholder={t('editor.cardio_name_placeholder', 'Corrida, bike, natação...')}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                ) : (
                  <MuscleWikiSearch
                    value={newItemName}
                    onChange={setNewItemName}
                    onSelect={handleNewExerciseSelect}
                    placeholder={t('musclewiki.search_placeholder', 'Buscar exercício...')}
                    autoFocus
                  />
                )}
              </div>

              {newItemType === 'cardio' && (
                <div className="space-y-1.5">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.duration_minutes', 'Duração (min)')}
                  </label>
                  <Input type="number" placeholder="15" value={newItemDuration} onChange={(e) => setNewItemDuration(e.target.value)} />
                </div>
              )}

              {newItemType !== 'cardio' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.sets')}
                  </label>
                  <Input type="number" placeholder={WORKOUT_DEFAULTS.SETS.toString()} value={newItemSets} onChange={(e) => setNewItemSets(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.reps')}
                  </label>
                  <Input type="text" placeholder={WORKOUT_DEFAULTS.REPS} value={newItemReps} onChange={(e) => setNewItemReps(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.rest_seconds')}
                  </label>
                  <Input type="number" placeholder={WORKOUT_DEFAULTS.REST_SECONDS.toString()} value={newItemRest} onChange={(e) => setNewItemRest(e.target.value)} />
                </div>
              </div>
              )}

              <div className="space-y-1.5">
                <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                  {t('common.notes')}
                </label>
                <Input placeholder={t('common.notes')} value={newItemNotes} onChange={(e) => setNewItemNotes(e.target.value)} />
              </div>

              {newItemType !== 'cardio' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.video_url')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewVideoSearchOpen((v) => !v)}
                    className="inline-flex items-center gap-1 font-ot-mono text-[9px] uppercase tracking-[0.1em]"
                    style={{ color: '#2a5fff' }}
                  >
                    <Video className="h-3 w-3" />
                    {t('musclewiki.search_video', 'Buscar na MuscleWiki')}
                  </button>
                </div>
                {newVideoSearchOpen && (
                  <MuscleWikiSearch
                    value={newVideoSearch}
                    onChange={setNewVideoSearch}
                    onSelect={(exercise) => {
                      if (exercise.videoUrl) setNewItemVideoUrl(exercise.videoUrl)
                      setNewVideoSearchOpen(false)
                    }}
                    placeholder={t('musclewiki.search_placeholder', 'Buscar exercício...')}
                  />
                )}
                <Input
                  placeholder="https://..."
                  value={newItemVideoUrl}
                  onChange={(e) => setNewItemVideoUrl(e.target.value)}
                  className={cn(newVideoUrlInvalid && 'border-ot-danger-text')}
                />
                {newVideoUrlInvalid && (
                  <p className="font-ot-mono text-[9px]" style={{ color: 'var(--color-ot-danger-text)' }}>
                    {t('common.video_url_invalid', 'Use http:// ou https://')}
                  </p>
                )}
              </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 rounded-[13px] border py-3 font-display text-[14px] font-bold uppercase transition-opacity"
                  style={{ borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newItemName || newVideoUrlInvalid}
                  className="flex-1 rounded-[13px] py-3 font-display text-[14px] font-bold uppercase text-[#0e0e10] transition-opacity disabled:opacity-40"
                  style={{ background: '#d8ff36' }}
                >
                  {t('common.add')}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full rounded-[20px] py-5 font-display text-[15px] font-bold uppercase transition-colors"
              style={{ border: '1.5px dashed var(--color-ot-border)', color: 'var(--color-ot-muted)', background: 'transparent' }}
            >
              + {t('editor.add_exercise', 'Adicionar exercício')}
            </button>
          )}
        </div>
      )}

      <VideoModal
        isOpen={!!videoModalItem}
        onClose={() => setVideoModalItem(null)}
        title={videoModalItem?.title ?? ''}
        videoUrl={videoModalItem?.url ?? null}
      />
    </div>
  )
}
