import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { Input } from '../components/ui/input'
import { GripVertical, Trash2, Video } from 'lucide-react'
import { cn, getSafeExternalUrl } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/skeleton'
import { useAuthStore } from '../stores/useAuthStore'

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
    deleteWorkoutItem
  } = useWorkoutStore()
  const user = useAuthStore(state => state.user)

  const [workoutName, setWorkoutName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemReps, setNewItemReps] = useState('')
  const [newItemSets, setNewItemSets] = useState('')
  const [newItemRest, setNewItemRest] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [newItemVideoUrl, setNewItemVideoUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editSets, setEditSets] = useState('')
  const [editRest, setEditRest] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editVideoUrl, setEditVideoUrl] = useState('')

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
        if (data) setWorkoutName(data.name)
        setInitialLoading(false)
      })
    }
  }, [workoutId, fetchWorkoutItems, user, ownerUserId])

  const handleAddItem = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!newItemName || !workoutId) return

    setIsSubmitting(true)
    await addWorkoutItem(
      workoutId,
      newItemName,
      activeWorkoutItems.length,
      newItemReps ? newItemReps : undefined,
      newItemSets ? parseInt(newItemSets) : undefined,
      newItemRest ? parseInt(newItemRest) : undefined,
      newItemNotes,
      newItemVideoUrl.trim() ? newItemVideoUrl.trim() : undefined,
      ownerUserId
    )
    setNewItemName('')
    setNewItemReps('')
    setNewItemSets('')
    setNewItemRest('')
    setNewItemNotes('')
    setNewItemVideoUrl('')
    setIsSubmitting(false)
    setShowAddForm(false)
  }

  const startEditing = (item: { id: string; title: string; default_reps?: string | null; default_sets?: number | null; rest_seconds?: number | null; notes?: string | null; video_url?: string | null }) => {
    setEditingId(item.id)
    setEditName(item.title)
    setEditReps(item.default_reps?.toString() || '')
    setEditSets(item.default_sets?.toString() || '')
    setEditRest(item.rest_seconds?.toString() || '')
    setEditNotes(item.notes || '')
    setEditVideoUrl(item.video_url || '')
  }

  const handleUpdateItem = async (itemId: string) => {
    await updateWorkoutItem(itemId, {
      title: editName,
      default_reps: editReps ? editReps : undefined,
      default_sets: editSets ? parseInt(editSets) : undefined,
      rest_seconds: editRest ? parseInt(editRest) : undefined,
      notes: editNotes,
      video_url: editVideoUrl.trim() ? editVideoUrl.trim() : undefined
    }, ownerUserId)
    setEditingId(null)
  }

  return (
    <div className="min-h-screen pb-28 font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ background: 'rgba(245,245,242,0.94)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #ececf0' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-colors"
          style={{ background: '#ffffff', border: '1px solid #e0e0e4' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9L11 14" stroke="#0e0e10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
            EDITOR DE TREINO
          </div>
          <h1 className="font-display text-[20px] font-extrabold uppercase leading-none truncate">
            {workoutName || '…'}
          </h1>
        </div>
      </div>

      {initialLoading ? (
        <div className="px-5 pt-6 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-[20px] bg-white p-4 flex items-center gap-3" style={{ border: '1px solid #e9e9ee' }}>
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
              <div className="font-display text-[56px] font-extrabold leading-none" style={{ color: '#e0e0e4' }}>0</div>
              <p className="mt-2 font-ot-mono text-[10px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
                NENHUM EXERCÍCIO AINDA
              </p>
            </div>
          )}

          {activeWorkoutItems.map((item, index) => {
            const safeVideoUrl = getSafeExternalUrl(item.video_url)
            const isEditing = editingId === item.id

            return (
              <div
                key={item.id}
                className="rounded-[20px] bg-white overflow-hidden transition-all"
                style={{
                  border: isEditing ? '1.5px solid #2a5fff' : '1px solid #e9e9ee',
                  boxShadow: isEditing ? '0 0 0 3px rgba(42,95,255,0.08)' : undefined,
                }}
              >
                {isEditing ? (
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                        {t('common.name')}
                      </label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.sets')}
                        </label>
                        <Input type="number" placeholder="3" value={editSets} onChange={(e) => setEditSets(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.reps')}
                        </label>
                        <Input type="text" placeholder="12" value={editReps} onChange={(e) => setEditReps(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                          {t('common.rest_seconds')}
                        </label>
                        <Input type="number" placeholder="60" value={editRest} onChange={(e) => setEditRest(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                        {t('common.notes')}
                      </label>
                      <Input placeholder={t('common.notes')} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                        {t('common.video_url')}
                      </label>
                      <Input
                        placeholder="https://..."
                        value={editVideoUrl}
                        onChange={(e) => setEditVideoUrl(e.target.value)}
                        className={cn(editVideoUrlInvalid && 'border-[#e5484d]')}
                      />
                      {editVideoUrlInvalid && (
                        <p className="font-ot-mono text-[9px]" style={{ color: '#e5484d' }}>
                          {t('common.video_url_invalid', 'Use http:// ou https://')}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-[13px] border py-3 font-display text-[14px] font-bold uppercase transition-opacity"
                        style={{ borderColor: '#e0e0e4', color: '#6a6a72' }}
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
                    <GripVertical className="h-5 w-5 flex-none" style={{ color: '#d0d0d8' }} />

                    <div
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] font-display text-[16px] font-extrabold"
                      style={{ background: '#eef2ff', color: '#2a5fff' }}
                    >
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="block font-display text-[17px] font-bold leading-none truncate">
                        {item.title}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {item.default_sets && (
                          <span className="font-ot-mono text-[10px]" style={{ color: '#6a6a72' }}>
                            {item.default_sets} {t('common.sets').toLowerCase()}
                          </span>
                        )}
                        {item.default_reps && (
                          <span className="font-ot-mono text-[10px]" style={{ color: '#6a6a72' }}>
                            × {item.default_reps}
                          </span>
                        )}
                        {item.rest_seconds != null && (
                          <span className="font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
                            {item.rest_seconds}s {t('common.rest').toLowerCase()}
                          </span>
                        )}
                        {item.notes && (
                          <span className="font-ot-mono text-[10px] italic" style={{ color: '#9a9aa2' }}>
                            {item.notes}
                          </span>
                        )}
                        {safeVideoUrl && (
                          <a
                            href={safeVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={t('common.video_url')}
                            className="inline-flex items-center justify-center"
                            style={{ color: '#2a5fff' }}
                          >
                            <Video className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-none">
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                        style={{ color: '#6a6a72' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWorkoutItem(item.id, ownerUserId)}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                        style={{ color: '#e5484d' }}
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
              className="rounded-[20px] bg-white p-4 space-y-4"
              style={{ border: '1.5px solid #2a5fff', boxShadow: '0 0 0 3px rgba(42,95,255,0.08)' }}
            >
              <div className="font-ot-mono text-[9px] tracking-[0.14em] uppercase font-bold" style={{ color: '#2a5fff' }}>
                {t('editor.add_exercise')}
              </div>

              <div className="space-y-1.5">
                <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                  {t('common.name')} *
                </label>
                <Input
                  placeholder={t('common.name')}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.sets')}
                  </label>
                  <Input type="number" placeholder="3" value={newItemSets} onChange={(e) => setNewItemSets(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.reps')}
                  </label>
                  <Input type="text" placeholder="12" value={newItemReps} onChange={(e) => setNewItemReps(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                    {t('common.rest_seconds')}
                  </label>
                  <Input type="number" placeholder="60" value={newItemRest} onChange={(e) => setNewItemRest(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                  {t('common.notes')}
                </label>
                <Input placeholder={t('common.notes')} value={newItemNotes} onChange={(e) => setNewItemNotes(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <label className="font-ot-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                  {t('common.video_url')}
                </label>
                <Input
                  placeholder="https://..."
                  value={newItemVideoUrl}
                  onChange={(e) => setNewItemVideoUrl(e.target.value)}
                  className={cn(newVideoUrlInvalid && 'border-[#e5484d]')}
                />
                {newVideoUrlInvalid && (
                  <p className="font-ot-mono text-[9px]" style={{ color: '#e5484d' }}>
                    {t('common.video_url_invalid', 'Use http:// ou https://')}
                  </p>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 rounded-[13px] border py-3 font-display text-[14px] font-bold uppercase transition-opacity"
                  style={{ borderColor: '#e0e0e4', color: '#6a6a72' }}
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
              style={{ border: '1.5px dashed #b3b3bb', color: '#6a6a72', background: 'transparent' }}
            >
              + {t('editor.add_exercise', 'Adicionar exercício')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
