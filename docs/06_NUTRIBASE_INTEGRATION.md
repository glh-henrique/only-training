# Integração NutriBase (webhook de calorias)

Quando um treino é **concluído** no OnlyTrain com calorias calculadas, o
Postgres envia as kcal para o NutriBase por webhook server-to-server. O PWA
não participa — tudo acontece no banco (Supabase).

## Arquitetura

```
finalizar treino (PWA)
  └─ update workout_sessions → status='finished', calories_kcal=<estimativa>
       └─ trigger workout_sessions_notify_nutribase (AFTER INSERT/UPDATE)
            └─ net.http_post (pg_net, assíncrono — nunca bloqueia a transação)
                 └─ POST https://piliinwwexyymbkenyrt.supabase.co/functions/v1/ingest-workout
                    header x-webhook-secret (lido do Vault)
                    body { email, date, kcal, external_id }
```

- `calories_kcal` é a estimativa calculada no cliente ao finalizar
  (`src/lib/calories.ts`: Keytel com FC média, senão MET via RPE) e persistida
  em `workout_sessions` (migration `2026-07-09_workout_sessions_calories.sql`).
- O trigger (`2026-07-09_nutribase_webhook.sql`) dispara **só** quando:
  - o treino fica `finished` (INSERT já concluído também conta), e
  - `0 < calories_kcal < 5000` (contrato do NutriBase).
- Edição de kcal em treino já concluído re-envia com o **mesmo `external_id`**
  (= id da sessão); o NutriBase faz upsert — idempotente.
- Falha do POST **nunca** aborta a gravação do treino: pg_net é assíncrono e a
  função engole exceções com `raise warning`.
- `email` vem de `auth.users` e é a identidade entre os dois sistemas.
  Resposta `{skipped:"no matching user"}` do NutriBase não é erro.
- Sem retry para `500` do destino: re-envios manuais são seguros (upsert).

## Passo manual: segredo no Vault (produção)

O segredo do webhook **não** está em código nem em migrations. Uma vez, no SQL
Editor do projeto OnlyTrain:

```sql
select vault.create_secret('<SEGREDO>', 'nutribase_webhook_secret');
```

Sem o segredo, o trigger vira no-op silencioso (treinos gravam normalmente e
nada é enviado). Para rotacionar:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'nutribase_webhook_secret'),
  '<NOVO_SEGREDO>'
);
```

## Testes

`sql/tests/nutribase_webhook.test.sql` — roda numa transação com rollback
(não deixa dados nem envia POSTs reais). Cobre: concluído com kcal enfileira o
payload certo; em andamento não dispara; sem kcal não dispara; correção de
kcal re-envia com o mesmo `external_id`; update irrelevante não re-envia.
Executar no SQL Editor do Supabase.

## Smoke test do endpoint (curl)

Com o segredo (espera `200 {"ok":true}` ou `{"skipped":"no matching user"}`):

```bash
curl -s -X POST 'https://piliinwwexyymbkenyrt.supabase.co/functions/v1/ingest-workout' \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: <SEGREDO>' \
  -d '{"email":"alguem@exemplo.com","date":"2026-07-09","kcal":420.5,"external_id":"smoke-test-1"}'
```

Sem segredo (espera `401`):

```bash
curl -s -X POST 'https://piliinwwexyymbkenyrt.supabase.co/functions/v1/ingest-workout' \
  -H 'Content-Type: application/json' \
  -d '{"email":"alguem@exemplo.com","date":"2026-07-09","kcal":420.5,"external_id":"smoke-test-1"}'
```

Para inspecionar entregas do lado OnlyTrain: `select * from net._http_response
order by id desc limit 10;` (respostas do pg_net).
