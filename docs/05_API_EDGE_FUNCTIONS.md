# Edge Functions

- POST /start-session
- PATCH /session-item/:id
- POST /finish-session
- POST /send-coach-invite
  - Body: `{ studentEmail: string }`
  - Cria convite e tenta enviar e-mail com link de aceite.
  - Se o provedor de e-mail nao estiver configurado, retorna `inviteLink` para compartilhamento manual.

## Required Secrets (send-coach-invite)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (opcional, mas necessario para envio real de e-mail)
- `COACH_INVITE_FROM` (opcional)
- `APP_BASE_URL` (opcional; ex: https://seu-dominio)
