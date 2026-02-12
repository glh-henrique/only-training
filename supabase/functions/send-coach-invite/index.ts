import { createClient } from 'npm:@supabase/supabase-js@2'

type InviteRpcRow = {
  invite_id: string
  token: string
  student_email: string
  expires_at: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'method_not_allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'missing_authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'missing_access_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const studentEmail = String(body?.studentEmail || '').trim().toLowerCase()
    if (!studentEmail) {
      return new Response(
        JSON.stringify({ error: 'invalid_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'missing_supabase_env' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'invalid_jwt', details: userError?.message ?? null }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    const { data, error } = await supabase.rpc('create_coach_invite', {
      student_email_input: studentEmail,
      expires_in_hours: 72,
    })
    if (error) throw error

    const invite = (data as InviteRpcRow[] | null)?.[0]
    if (!invite?.token) {
      throw new Error('invite_not_created')
    }

    const appBaseUrl =
      Deno.env.get('APP_BASE_URL') ??
      req.headers.get('origin') ??
      supabaseUrl.replace('.supabase.co', '.pages.dev')
    const inviteLink = `${appBaseUrl}/#/accept-invite?token=${encodeURIComponent(invite.token)}`

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const mailFrom = Deno.env.get('COACH_INVITE_FROM') ?? 'OnlyTraining <noreply@onlytraining.app>'

    // Fallback mode: invite link is returned when email provider isn't configured.
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: false,
          reason: 'email_provider_not_configured',
          inviteId: invite.invite_id,
          expiresAt: invite.expires_at,
          inviteLink,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const subject = 'Convite para treino no OnlyTraining'
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;">
        <h2>Voce recebeu um convite de instrutor</h2>
        <p>Para aceitar, clique no link abaixo:</p>
        <p><a href="${inviteLink}">${inviteLink}</a></p>
        <p>Se voce nao esperava esse convite, ignore este email.</p>
      </div>
    `

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom,
        to: [studentEmail],
        subject,
        html,
      }),
    })

    if (!emailResponse.ok) {
      const errorPayload = await emailResponse.text()
      return new Response(
        JSON.stringify({
          success: false,
          sent: false,
          reason: 'email_send_failed',
          details: errorPayload,
          inviteId: invite.invite_id,
          expiresAt: invite.expires_at,
          inviteLink,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        inviteId: invite.invite_id,
        expiresAt: invite.expires_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message ?? 'unexpected_error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
