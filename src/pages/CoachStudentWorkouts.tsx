import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Pencil, Archive, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import type { Database } from '../types/database.types'

type LinkRow = Database['public']['Tables']['coach_student_links']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type WorkoutRow = Database['public']['Tables']['workouts']['Row']

type StudentGroup = {
  studentId: string
  studentName: string
  studentGym: string | null
  expanded: boolean
  workouts: WorkoutRow[]
  creating: boolean
  newWorkoutName: string
  newWorkoutFocus: string
}

export default function CoachStudentWorkouts() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedStudentId = searchParams.get('student')
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const studentCount = useMemo(() => groups.length, [groups.length])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const coachId = authData.user?.id
      if (!coachId) throw new Error('User not authenticated')

      const { data: linksData, error: linksError } = await supabase
        .from('coach_student_links')
        .select('*')
        .eq('coach_id', coachId)
        .eq('status', 'active')
      if (linksError) throw linksError

      const studentIds = Array.from(new Set((linksData || []).map((l: LinkRow) => l.student_id)))
      if (studentIds.length === 0) {
        setGroups([])
        return
      }

      const [{ data: profilesData, error: profilesError }, { data: workoutsData, error: workoutsError }] = await Promise.all([
        supabase.from('profiles').select('*').in('user_id', studentIds),
        supabase
          .from('workouts')
          .select('*')
          .in('user_id', studentIds)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
      ])

      if (profilesError) throw profilesError
      if (workoutsError) throw workoutsError

      const profilesById = Object.fromEntries((profilesData || []).map((p: ProfileRow) => [p.user_id, p]))
      const workoutsByStudent = new Map<string, WorkoutRow[]>()
      ;(workoutsData || []).forEach((w: WorkoutRow) => {
        const current = workoutsByStudent.get(w.user_id) || []
        current.push(w)
        workoutsByStudent.set(w.user_id, current)
      })

      setGroups((prev) => studentIds.map((studentId) => {
        const existing = prev.find((g) => g.studentId === studentId)
        const shouldAutoExpand = selectedStudentId === studentId
        return {
          studentId,
          studentName: profilesById[studentId]?.full_name || t('coach.workouts.unnamed_student'),
          studentGym: profilesById[studentId]?.gym_name ?? null,
          expanded: shouldAutoExpand ? true : (existing?.expanded ?? false),
          workouts: workoutsByStudent.get(studentId) || [],
          creating: false,
          newWorkoutName: '',
          newWorkoutFocus: '',
        }
      }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [selectedStudentId])

  const toggleExpanded = (studentId: string) => {
    setGroups((prev) => prev.map((g) => g.studentId === studentId ? { ...g, expanded: !g.expanded } : g))
  }

  const setCreating = (studentId: string, creating: boolean) => {
    setGroups((prev) => prev.map((g) => g.studentId === studentId ? { ...g, creating } : g))
  }

  const setNewWorkoutField = (studentId: string, field: 'newWorkoutName' | 'newWorkoutFocus', value: string) => {
    setGroups((prev) => prev.map((g) => g.studentId === studentId ? { ...g, [field]: value } : g))
  }

  const createWorkoutForStudent = async (group: StudentGroup) => {
    if (!group.newWorkoutName.trim() || !group.newWorkoutFocus.trim()) return
    setError(null)
    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: group.studentId,
          name: group.newWorkoutName.trim(),
          focus: group.newWorkoutFocus.trim(),
        })
        .select('*')
        .single()

      if (error) throw error

      setGroups((prev) => prev.map((g) => g.studentId === group.studentId
        ? {
            ...g,
            workouts: [data, ...g.workouts],
            creating: false,
            newWorkoutName: '',
            newWorkoutFocus: '',
          }
        : g
      ))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const archiveWorkout = async (group: StudentGroup, workoutId: string) => {
    setError(null)
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ is_archived: true })
        .eq('id', workoutId)
        .eq('user_id', group.studentId)
      if (error) throw error
      setGroups((prev) => prev.map((g) => g.studentId === group.studentId ? { ...g, workouts: g.workouts.filter((w) => w.id !== workoutId) } : g))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const deleteWorkout = async (group: StudentGroup, workoutId: string) => {
    if (!window.confirm(t('workouts.delete_desc_full'))) return
    setError(null)
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', group.studentId)
      if (error) throw error
      setGroups((prev) => prev.map((g) => g.studentId === group.studentId ? { ...g, workouts: g.workouts.filter((w) => w.id !== workoutId) } : g))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      <header className="p-4 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/coach-panel')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t('coach.workouts.title')}</h1>
          <p className="text-xs text-neutral-500">{t('coach.workouts.subtitle', { count: studentCount })}</p>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto space-y-3">
        {loading && <p className="text-sm text-neutral-500">{t('common.loading')}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && groups.length === 0 && (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-neutral-500">
            {t('coach.workouts.no_students')}
          </div>
        )}

        {groups.map((group) => (
          <section key={group.studentId} className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => toggleExpanded(group.studentId)}
            >
              <div className="text-left">
                <p className="font-semibold">{group.studentName}</p>
                {group.studentGym?.trim() ? (
                  <p className="text-xs text-neutral-500">{t('profile.training_at', { gym: group.studentGym.trim() })}</p>
                ) : null}
                <p className="text-xs text-neutral-500">{t('coach.workouts.count', { count: group.workouts.length })}</p>
              </div>
              {group.expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>

            {group.expanded && (
              <div className="p-4 space-y-3">
                <div className="flex justify-end">
                  {!group.creating ? (
                    <Button size="sm" onClick={() => setCreating(group.studentId, true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('coach.workouts.create')}
                    </Button>
                  ) : (
                    <div className="w-full grid grid-cols-1 md:grid-cols-[2fr_2fr_auto_auto] gap-2">
                      <Input
                        value={group.newWorkoutName}
                        onChange={(e) => setNewWorkoutField(group.studentId, 'newWorkoutName', e.target.value)}
                        placeholder={t('common.name')}
                      />
                      <Input
                        value={group.newWorkoutFocus}
                        onChange={(e) => setNewWorkoutField(group.studentId, 'newWorkoutFocus', e.target.value)}
                        placeholder={t('home.focus')}
                      />
                      <Button size="sm" onClick={() => createWorkoutForStudent(group)}>{t('common.create')}</Button>
                      <Button size="sm" variant="outline" onClick={() => setCreating(group.studentId, false)}>{t('common.cancel')}</Button>
                    </div>
                  )}
                </div>

                {group.workouts.length === 0 ? (
                  <p className="text-sm text-neutral-500">{t('home.no_workouts')}</p>
                ) : (
                  <div className="space-y-2">
                    {group.workouts.map((workout) => (
                      <div key={workout.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{workout.name}</p>
                          <p className="text-xs text-neutral-500">{workout.focus}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/workout/${workout.id}/edit?owner=${group.studentId}`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => archiveWorkout(group, workout.id)}>
                            <Archive className="h-4 w-4 text-amber-500" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteWorkout(group, workout.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}
