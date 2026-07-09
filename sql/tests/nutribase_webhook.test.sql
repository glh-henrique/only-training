-- Teste do trigger de integração NutriBase (sql/2026-07-09_nutribase_webhook.sql).
-- Roda inteiro numa transação com ROLLBACK no fim: não deixa dados nem
-- dispara POSTs reais (o worker do pg_net só envia requisições commitadas).
-- Executar no SQL Editor do Supabase ou via psql.

begin;

-- Segredo de teste apenas se o real ainda não existir (rollback remove)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'nutribase_webhook_secret') then
    perform vault.create_secret('test-secret', 'nutribase_webhook_secret');
  end if;
end $$;

-- Usuário de teste
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000cafe', 'authenticated', 'authenticated', 'nutritest@example.com', '', now(), now(), now());

do $$
declare
  q0 bigint;
  q1 bigint;
  v_body jsonb;
  v_headers jsonb;
  v_sid uuid;
begin
  select count(*) into q0 from net.http_request_queue;

  -- (a) treino concluído com kcal → enfileira POST com o payload do contrato
  insert into public.workout_sessions (user_id, workout_name_snapshot, status, started_at, ended_at, duration_seconds, calories_kcal)
  values ('00000000-0000-0000-0000-00000000cafe', 'Teste NutriBase', 'finished', now(), now(), 3600, 420.5)
  returning id into v_sid;

  select count(*) into q1 from net.http_request_queue;
  assert q1 = q0 + 1, format('(a) esperava 1 POST enfileirado, fila foi de %s para %s', q0, q1);

  select convert_from(body, 'utf8')::jsonb, headers into v_body, v_headers
  from net.http_request_queue order by id desc limit 1;
  assert v_body->>'email' = 'nutritest@example.com', '(a) email errado: ' || (v_body->>'email');
  assert v_body->>'external_id' = v_sid::text, '(a) external_id errado';
  assert (v_body->>'kcal')::numeric = 420.5, '(a) kcal errado: ' || (v_body->>'kcal');
  assert v_body->>'date' ~ '^\d{4}-\d{2}-\d{2}$', '(a) date fora de YYYY-MM-DD: ' || (v_body->>'date');
  assert v_headers ? 'x-webhook-secret', '(a) header x-webhook-secret ausente';

  -- (b) treino não concluído não dispara
  insert into public.workout_sessions (user_id, workout_name_snapshot, status, started_at, calories_kcal)
  values ('00000000-0000-0000-0000-00000000cafe', 'Teste em andamento', 'in_progress', now(), 300);
  select count(*) into q1 from net.http_request_queue;
  assert q1 = q0 + 1, '(b) treino in_progress não deveria disparar';

  -- (c) treino concluído sem kcal não dispara
  insert into public.workout_sessions (user_id, workout_name_snapshot, status, started_at, ended_at)
  values ('00000000-0000-0000-0000-00000000cafe', 'Teste sem kcal', 'finished', now(), now());
  select count(*) into q1 from net.http_request_queue;
  assert q1 = q0 + 1, '(c) treino sem kcal não deveria disparar';

  -- (d) kcal corrigidas em treino concluído → re-envia (mesmo external_id, upsert no destino)
  update public.workout_sessions set calories_kcal = 500 where id = v_sid;
  select count(*) into q1 from net.http_request_queue;
  assert q1 = q0 + 2, '(d) correção de kcal deveria re-enviar';
  select convert_from(body, 'utf8')::jsonb into v_body
  from net.http_request_queue order by id desc limit 1;
  assert v_body->>'external_id' = v_sid::text, '(d) re-envio deve manter o external_id';

  -- (e) update sem mudança de kcal não re-envia
  update public.workout_sessions set rpe = 7, status = 'finished' where id = v_sid;
  select count(*) into q1 from net.http_request_queue;
  assert q1 = q0 + 2, '(e) update sem mudar kcal não deveria re-enviar';

  raise notice 'nutribase_webhook.test: todos os asserts passaram';
end $$;

rollback;
