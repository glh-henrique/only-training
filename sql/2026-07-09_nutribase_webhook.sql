-- ── Integração NutriBase ──
-- Quando um treino fica concluído com calorias calculadas, envia
-- {email, date, kcal, external_id} para o webhook do NutriBase via pg_net
-- (assíncrono: o POST nunca bloqueia nem aborta a gravação do treino).
--
-- Pré-requisito MANUAL (não versionar o segredo!):
--   select vault.create_secret('<SEGREDO>', 'nutribase_webhook_secret');
-- Sem o segredo no Vault o trigger vira no-op silencioso.

create extension if not exists pg_net;

create or replace function public.notify_nutribase_workout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_email text;
begin
  -- só treinos concluídos, com kcal válidas pelo contrato (0 < kcal < 5000)
  if new.status <> 'finished' then
    return new;
  end if;
  if new.calories_kcal is null or new.calories_kcal <= 0 or new.calories_kcal >= 5000 then
    return new;
  end if;
  -- UPDATE de treino já concluído: só re-envia se as kcal mudaram
  -- (mesmo external_id → o NutriBase faz upsert, idempotente)
  if tg_op = 'UPDATE'
     and old.status = 'finished'
     and new.calories_kcal is not distinct from old.calories_kcal then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'nutribase_webhook_secret'
  limit 1;

  if v_secret is null then
    return new; -- segredo não configurado: não bloquear o treino
  end if;

  select email into v_email
  from auth.users
  where id = new.user_id;

  if v_email is null then
    return new;
  end if;

  -- ponytail: fuso fixo America/Sao_Paulo para a "data local" do treino;
  -- trocar por fuso por-usuário se o app sair do Brasil
  perform net.http_post(
    url := 'https://piliinwwexyymbkenyrt.supabase.co/functions/v1/ingest-workout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'email', v_email,
      'date', to_char((coalesce(new.ended_at, now()) at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
      'kcal', new.calories_kcal,
      'external_id', new.id::text
    )
  );
  return new;
exception
  when others then
    -- o webhook nunca pode abortar a gravação do treino
    raise warning 'notify_nutribase_workout failed: %', sqlerrm;
    return new;
end;
$$;

-- Sem retry para 500 do destino: pg_net é fire-and-forget e re-envios manuais
-- são idempotentes (upsert por external_id). ponytail: fila de retry se a
-- perda de eventos transitórios virar problema real.

drop trigger if exists workout_sessions_notify_nutribase on public.workout_sessions;
create trigger workout_sessions_notify_nutribase
  after insert or update of status, calories_kcal on public.workout_sessions
  for each row
  execute function public.notify_nutribase_workout();
