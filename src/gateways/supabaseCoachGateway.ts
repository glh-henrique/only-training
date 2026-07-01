import type { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'

type LinkRow = Database['public']['Tables']['coach_student_links']['Row']
type InviteRow = Database['public']['Tables']['coach_student_invites']['Row']
type UnlinkRequestRow = Database['public']['Tables']['coach_student_unlink_requests']['Row']

export const supabaseCoachGateway = {
  fetchLinksByCoach: async (coachId: string): Promise<LinkRow[]> => {
    const { data, error } = await supabase
      .from('coach_student_links')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  fetchActiveLinksByCoach: async (coachId: string): Promise<LinkRow[]> => {
    const { data, error } = await supabase
      .from('coach_student_links')
      .select('*')
      .eq('coach_id', coachId)
      .eq('status', 'active')

    if (error) throw error
    return data ?? []
  },
  fetchActiveLinkForStudent: async (studentId: string): Promise<LinkRow | null> => {
    const { data, error } = await supabase
      .from('coach_student_links')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle()

    if (error) throw error
    return data
  },
  fetchLinkById: async (linkId: string): Promise<LinkRow | null> => {
    const { data, error } = await supabase
      .from('coach_student_links')
      .select('*')
      .eq('id', linkId)
      .maybeSingle()

    if (error) throw error
    return data
  },
  setStudentCanUnlink: async (linkId: string, value: boolean): Promise<void> => {
    const { error } = await supabase
      .from('coach_student_links')
      .update({ student_can_unlink: value })
      .eq('id', linkId)

    if (error) throw error
  },
  fetchInvitesByCoach: async (coachId: string): Promise<InviteRow[]> => {
    const { data, error } = await supabase
      .from('coach_student_invites')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  // RLS já restringe aos requests visíveis pelo usuário logado.
  fetchAllUnlinkRequests: async (): Promise<UnlinkRequestRow[]> => {
    const { data, error } = await supabase
      .from('coach_student_unlink_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  fetchPendingUnlinkRequest: async (linkId: string): Promise<UnlinkRequestRow | null> => {
    const { data, error } = await supabase
      .from('coach_student_unlink_requests')
      .select('*')
      .eq('link_id', linkId)
      .eq('status', 'pending')
      .maybeSingle()

    if (error) throw error
    return data
  },
  acceptInvite: async (token: string): Promise<void> => {
    const { error } = await supabase.rpc('accept_coach_invite', { token_input: token })
    if (error) throw error
  },
  requestStudentUnlink: async (linkId: string): Promise<string> => {
    const { data, error } = await supabase.rpc('request_student_unlink', { link_id_input: linkId })
    if (error) throw error
    return data
  },
  resolveUnlinkRequest: async (requestId: string, approve: boolean): Promise<void> => {
    const { error } = await supabase.rpc('resolve_unlink_request', {
      request_id_input: requestId,
      approve_input: approve
    })
    if (error) throw error
  },
  sendInvite: async (studentEmail: string): Promise<{ success?: boolean; sent?: boolean; inviteLink?: string } | null> => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const accessToken = sessionData.session?.access_token
    if (!accessToken) throw new Error('Not authenticated')

    const { data, error } = await supabase.functions.invoke('send-coach-invite', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { studentEmail }
    })
    if (error) throw error
    return data
  }
}
