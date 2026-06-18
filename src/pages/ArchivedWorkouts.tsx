import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f2', color: '#0e0e10', paddingBottom: 48, fontFamily: "'Archivo', sans-serif" }}>

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
          <div key={i} style={{ background: '#fff', border: '1px solid #e9e9ee', borderRadius: 18, padding: '16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: 140, height: 16, borderRadius: 6, background: '#e9e9ee' }} />
              <div style={{ width: 90, height: 11, borderRadius: 6, background: '#f0f0f4' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f0f4' }} />
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f0f4' }} />
            </div>
          </div>
        ))}

        {/* Empty state */}
        {!loading && archived.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center', gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e9e9ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#b3b3bb' }}>
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

        {/* Workout cards */}
        {!loading && archived.map((workout, idx) => {
          const letter = String.fromCharCode(65 + idx)
          return (
            <div key={workout.id} style={{ background: '#fff', border: '1px solid #e9e9ee', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Letter badge */}
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f5f5f2', border: '1.5px solid #e0e0e4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                  style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #e0e0e4', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2a5fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                  </svg>
                </button>
                <button
                  type="button"
                  title={t('common.delete', 'Excluir')}
                  onClick={() => setDeleteModal({ isOpen: true, id: workout.id })}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #fee2e2', background: '#fff5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e5484d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
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
