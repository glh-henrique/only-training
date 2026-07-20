import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Home, Dumbbell } from 'lucide-react'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { AlertModal } from '../components/ui/alert-modal'
import { supabase } from '../lib/supabase'
import type { WorkoutWithStats } from '../stores/useWorkoutStore'

export default function ArchivedWorkouts() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { unarchiveWorkout, deleteWorkout } = useWorkoutStore()
  const [archived, setArchived] = useState<WorkoutWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [unarchiveModal, setUnarchiveModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })
  const [activeTab, setActiveTab] = useState<'gym' | 'home'>('gym')

  const gymArchived = archived.filter(w => w.location !== 'home')
  const homeArchived = archived.filter(w => w.location === 'home')
  // Só filtra por local quando existem treinos arquivados nas duas categorias.
  const showLocationTabs = gymArchived.length > 0 && homeArchived.length > 0

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

  useEffect(() => { fetchArchived() }, [])

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

  const renderCard = (workout: WorkoutWithStats, idx: number) => {
    const letter = String.fromCharCode(65 + idx)
    return (
      <div key={workout.id} style={{ background: 'var(--color-ot-card)', border: '1px solid var(--color-ot-border)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Letter badge */}
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-ot-paper)', border: '1.5px solid var(--color-ot-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: '#b3b3bb' }}>{letter}</span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {workout.focus || workout.name}
          </div>
          {workout.focus && workout.name && (
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#9a9aa2', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workout.name}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            title={t('common.restore', 'Restaurar')}
            onClick={() => setUnarchiveModal({ isOpen: true, id: workout.id })}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid var(--color-ot-border)', background: 'var(--color-ot-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2a5fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" />
            </svg>
          </button>
          <button
            type="button"
            title={t('common.delete', 'Excluir')}
            onClick={() => setDeleteModal({ isOpen: true, id: workout.id })}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid var(--color-ot-danger-border)', background: 'var(--color-ot-danger-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ot-danger-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  const renderPanel = (list: WorkoutWithStats[], location: 'gym' | 'home') => (
    <div className="w-1/2 flex-none flex flex-col gap-2">
      {list.length > 0
        ? list.map((workout, idx) => renderCard(workout, idx))
        : (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#9a9aa2' }}>
              {location === 'home' ? t('workouts.empty_home', 'Nenhum treino em casa ainda.') : t('workouts.empty_gym', 'Nenhum treino na academia ainda.')}
            </p>
          </div>
        )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)', paddingBottom: 48, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 22px 0' }}>
        <button type="button" onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ArrowLeft className="h-5 w-5" style={{ color: '#6a6a72' }} />
        </button>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: '#9a9aa2' }}>
          {t('workouts.archived').toUpperCase()}
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* Count label */}
      {!loading && archived.length > 0 && (
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 42, lineHeight: 0.9, textTransform: 'uppercase' }}>
            {archived.length}
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', color: '#9a9aa2', marginTop: 4 }}>
            {archived.length === 1
              ? t('workouts.count', { count: archived.length })
              : t('workouts.count_plural', { count: archived.length })}
          </div>
        </div>
      )}

      <div style={{ padding: '18px 22px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Skeleton */}
        {loading && [1, 2, 3].map(i => (
          <div key={i} style={{ background: 'var(--color-ot-card)', border: '1px solid var(--color-ot-border)', borderRadius: 18, padding: '16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: 140, height: 16, borderRadius: 6, background: 'var(--color-ot-border)' }} />
              <div style={{ width: 90, height: 11, borderRadius: 6, background: 'var(--color-ot-paper)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-ot-paper)' }} />
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-ot-paper)' }} />
            </div>
          </div>
        ))}

        {/* Empty state */}
        {!loading && archived.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center', gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-ot-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#b3b3bb' }}>
              □
            </div>
            <div>
              <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>
                {t('workouts.archive_empty_title')}
              </div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#9a9aa2', marginTop: 6, lineHeight: 1.6 }}>
                {t('workouts.archive_empty_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Uma categoria só: lista direta, sem tabs. */}
        {!loading && archived.length > 0 && !showLocationTabs && (
          <div className="flex flex-col gap-2">
            {archived.map((workout, idx) => renderCard(workout, idx))}
          </div>
        )}

        {/* Tabs + sliding panels (só com treinos nas duas categorias) */}
        {!loading && showLocationTabs && (
          <>
            <div className="relative flex rounded-[14px] border border-ot-border p-1" style={{ background: 'var(--color-ot-card)' }}>
              <div
                className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[11px] bg-ot-blue transition-transform duration-300 ease-out"
                style={{ transform: activeTab === 'gym' ? 'translateX(0)' : 'translateX(100%)' }}
              />
              {(['gym', 'home'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="relative z-10 flex flex-1 items-center justify-center gap-2 py-2.5 font-display text-[13px] font-bold uppercase transition-colors"
                  style={{ color: activeTab === tab ? '#fff' : 'var(--color-ot-muted)' }}
                >
                  {tab === 'gym' ? <Dumbbell className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                  {tab === 'gym' ? t('workouts.location_gym', 'Academia') : t('workouts.location_home', 'Casa')}
                </button>
              ))}
            </div>

            <div className="overflow-hidden">
              <div
                className="flex w-[200%] transition-transform duration-300 ease-out"
                style={{ transform: activeTab === 'gym' ? 'translateX(0)' : 'translateX(-50%)' }}
              >
                {renderPanel(gymArchived, 'gym')}
                {renderPanel(homeArchived, 'home')}
              </div>
            </div>
          </>
        )}
      </div>

      <AlertModal
        isOpen={unarchiveModal.isOpen}
        onClose={() => setUnarchiveModal({ isOpen: false, id: null })}
        onConfirm={handleUnarchive}
        variant="info"
        title={t('workouts.unarchive_title')}
        description={t('workouts.unarchive_desc')}
        confirmLabel={t('common.restore', 'Restaurar')}
      />

      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        variant="danger"
        title={t('workouts.delete_title')}
        description={t('workouts.delete_desc_full')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
