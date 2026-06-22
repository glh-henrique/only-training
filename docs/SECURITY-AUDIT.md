# Auditoria de Segurança — OnlyTraining

**Data:** 2026-06-22
**Escopo:** Código-fonte completo (frontend React/PWA, edge functions Supabase, SQL/RLS, histórico git, dependências, TWA/Android).
**Branch auditado:** `feat/twa-android-apk`

---

## Resumo executivo

A postura de segurança do projeto é **boa**. Não foram encontrados segredos
vazados, a autorização no banco (RLS) é consistente e as edge functions validam
autenticação. Os achados são em sua maioria de **hardening** e **defesa em
profundidade**, com **um item de alta prioridade**: dependências com CVEs
conhecidos (`react-router`, `ws`).

| # | Severidade | Item | Status |
|---|-----------|------|--------|
| 1 | 🔴 Alta | Dependências vulneráveis (react-router, ws) | ✅ Corrigido (2026-06-22) |
| 2 | 🟠 Média | URL de vídeo do MuscleWiki não sanitizada | ✅ Corrigido (2026-06-22) |
| 3 | 🟠 Média | CORS `*` em todas as edge functions | Recomendado |
| 4 | 🟠 Média | Vazamento de detalhes em respostas de erro | ✅ Corrigido (2026-06-22) |
| 5 | 🟡 Baixa | Edge functions de IA sem rate limiting (abuso de custo) | Recomendado |
| 6 | 🟡 Baixa | Ausência de Content-Security-Policy / security headers | Recomendado |
| 7 | 🟡 Baixa | Tokens de auth em localStorage (risco padrão de XSS) | Aceitar/Monitorar |

> **Atualização 2026-06-22:** itens 1, 2 e 4 corrigidos. `react-router-dom`
> atualizado para `^7.18.0` e `ws` fixado em `^8.21.0` via `overrides` →
> **`npm audit --omit=dev` = 0 vulnerabilidades**. Sanitização de URL centralizada
> no `VideoModal`. Detalhes de erro (OpenAI/Resend/JWT) agora só vão para
> `console.error` no servidor. Build e suíte de regressão validados.

---

## Achados detalhados

### 🔴 1. Dependências com vulnerabilidades conhecidas (Alta)
`npm audit` reporta **3 vulnerabilidades de severidade alta**:

- **`react-router` / `react-router-dom` 7.13.0** — múltiplos CVEs:
  - RCE não autenticada via `turbo-stream` (GHSA-49rj-9fvp-4h2h)
  - Open redirect via URL protocol-relative `//` (GHSA-2j2x-hqr9-3h42)
  - XSS em redirect handling / Location header (GHSA-8646-j5j9-6r62, GHSA-f22v-gfqf-p8f3)
  - DoS e CSRF (GHSA-8x6r-g9mw-2r78, GHSA-rxv8-25v2-qmq8, GHSA-84g9-w2xq-vcv6)
- **`ws` 8.x** — divulgação de memória não inicializada e DoS (GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p).

Nem todos exploráveis nesta arquitetura (SPA estática, sem SSR/RSC), mas o open
redirect e XSS são relevantes.

**Ação:**
```bash
npm audit fix          # ou bump explícito:
npm i react-router-dom@latest
```
Depois rode os testes de regressão (`scripts/test-core-regression.mjs`) e valide o roteamento.

---

### 🟠 2. URL de vídeo de fonte externa não sanitizada (Média)
**Arquivo:** [src/components/MuscleWikiSearch.tsx:159](../src/components/MuscleWikiSearch.tsx#L159)

`WorkoutEditor` e `WorkoutSession` passam a URL por `getSafeExternalUrl()` antes
de renderizar, mas `MuscleWikiSearch` repassa `videoExercise.videoUrl`
**diretamente** ao `VideoModal`. O `VideoModal` renderiza `<a href={videoUrl}>` e
`<video src={videoUrl}>`. Como a URL vem de uma API de terceiro (MuscleWiki), um
valor `javascript:` malicioso (upstream comprometido/MITM) executaria ao clicar
em "abrir externamente".

**Ação:** aplicar `getSafeExternalUrl()` também aqui, ou centralizar a
sanitização dentro do próprio `VideoModal` (preferível — corrige todos os
chamadores de uma vez):

```tsx
// dentro de VideoModal, antes de usar videoUrl:
const safe = getSafeExternalUrl(videoUrl)
// usar `safe` no <a href> e no fallback <video src>
```

---

### 🟠 3. CORS aberto (`Access-Control-Allow-Origin: *`) (Média)
**Arquivos:** todas as edge functions em `supabase/functions/*/index.ts`.

Mitigado porque todas exigem `Authorization: Bearer <jwt>` e validam via
`auth.getUser()`. Ainda assim, `*` permite que qualquer site invoque as funções
com o token da vítima (se obtido). Recomenda-se restringir à origem do app.

**Ação:** refletir a origem permitida a partir de `APP_BASE_URL` em vez de `*`.

---

### 🟠 4. Vazamento de detalhes internos em respostas de erro (Média)
**Arquivos:**
- [supabase/functions/send-coach-invite/index.ts:142](../supabase/functions/send-coach-invite/index.ts) — retorna `details` do payload bruto do Resend.
- `generate-workout-plan` / `generate-daily-motivation` / `generate-workout-playlist` — retornam `details` do erro do OpenAI e `userError?.message` ao cliente.

Expõe mensagens internas (provedor, estrutura de requisição) que ajudam um
atacante. **Ação:** logar detalhes no servidor (`console.error`) e devolver ao
cliente apenas um código de erro genérico.

---

### 🟡 5. Edge functions de IA sem rate limiting (Baixa — risco de custo)
`generate-workout-plan/playlist/daily-motivation` chamam a API paga da OpenAI.
Qualquer usuário **autenticado** pode dispará-las em loop, gerando custo
ilimitado (abuso financeiro / DoS de orçamento).

**Ação:** rate limit/quota por usuário (ex.: tabela de contagem por
`user_id`/dia, ou um proxy com limite). Definir teto de gasto na conta OpenAI.

---

### 🟡 6. Ausência de Content-Security-Policy e security headers (Baixa)
O PWA é servido estaticamente (GitHub Pages / Cloudflare Pages). Não há CSP,
`X-Content-Type-Options`, `Referrer-Policy` nem `Permissions-Policy`. Uma CSP
reduz o impacto de qualquer XSS futuro (defesa em profundidade — relevante dado
que o token fica em `localStorage`, ver item 7).

**Ação:** se hospedado no Cloudflare Pages, adicionar `public/_headers` com CSP
(permitindo `*.supabase.co`, `youtube.com`, `vimeo.com`, `musclewiki.com`),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

### 🟡 7. Tokens de autenticação em localStorage (Baixa — risco padrão)
O `supabase-js` persiste o access/refresh token em `localStorage` por padrão.
Em caso de XSS, o token é roubável. É o comportamento padrão e aceitável, desde
que se mantenha XSS = 0 (ver itens 1, 2, 6). **Ação:** monitorar; tratar
qualquer XSS como crítico.

---

## Itens verificados e CORRETOS ✅

- **Nenhum segredo versionado.** `.env`, `*.keystore`, `*.jks`, `*.aab`, `*.apk`
  estão no `.gitignore`. Apenas `.env.example` (placeholders) é rastreado.
- **Histórico git limpo.** Nenhuma `service_role` key, chave OpenAI (`sk-…`) ou
  Resend (`re_…`) no histórico. A URL do projeto e a **anon key** presentes no
  bundle gh-pages são **públicas por design** (protegidas por RLS).
- **RLS habilitado em todas as tabelas** (`workouts`, `workout_items`,
  `workout_sessions`, `session_items`, `profiles`, `coach_student_*`), com
  políticas baseadas em `auth.uid()` e funções `can_read/write_user_training_data`.
- **11/11 funções `SECURITY DEFINER` fixam `search_path`** — protegidas contra
  escalonamento por sequestro de `search_path`.
- **Tokens de convite hasheados** (`sha256`) no banco; o token em claro nunca é
  persistido.
- **Edge functions validam JWT** via `auth.getUser(accessToken)` mesmo com
  `verify_jwt = false`. `send-coach-invite` usa o token do usuário (respeita RLS).
- **`getSafeExternalUrl`** valida o protocolo (`http`/`https`) — bloqueia
  `javascript:`/`data:` nos fluxos do editor e da sessão.
- **Service worker** cacheia apenas scripts/estilos/imagens — **não** cacheia
  respostas de API/auth.
- **Sem `dangerouslySetInnerHTML`, `eval`, `new Function` ou `document.write`** no código.
- **`assetlinks.json`**: o SHA-256 da keystore é público por design (Digital
  Asset Links); não é segredo.

---

## Plano de ação priorizado

1. **Agora:** `npm audit fix` / atualizar `react-router-dom` (item 1).
2. **Esta semana:** sanitizar URL no `VideoModal` (item 2); ocultar `details` nas
   respostas de erro das functions (item 4).
3. **Próxima iteração:** rate limiting nas functions de IA (item 5); CORS por
   origem (item 3); `_headers` com CSP (item 6).
4. **Contínuo:** manter XSS = 0; adicionar `npm audit` ao CI.
