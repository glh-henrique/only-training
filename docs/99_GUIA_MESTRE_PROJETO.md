# Guia Mestre do Projeto - OnlyTraining

> Documento unico para onboarding, arquitetura, negocio, estrategia, design e operacao do produto.
> Publico alvo: qualquer pessoa que nunca viu o sistema e precisa entender como ele funciona end-to-end.

## 1. Resumo Executivo

OnlyTraining e um app web (PWA) para organizacao e execucao de treinos.
O sistema suporta dois perfis:
- `aluno`
- `instrutor` (profissional/professor)

O foco do produto e permitir:
- criacao e gestao de treinos
- execucao com timer e registro de progresso
- historico de sessoes
- relacionamento instrutor-aluno com convite por email e controle de desvinculacao

Stack principal:
- Frontend: React 19 + TypeScript + Vite
- Estado local: Zustand
- Estilo: Tailwind v4
- Backend: Supabase (Auth + Postgres + RLS + RPC + Edge Function)
- Deploy: GitHub Pages (`npm run deploy`)

---

## 2. Objetivo de Produto e Negocio

## 2.1 Problema que resolvemos
- Usuarios e instrutores controlam treinos de forma dispersa (papel, planilhas, apps genericos).
- Falta continuidade entre planejamento, execucao e historico.
- Falta governanca para instrutor gerenciar varios alunos com regras claras de permissao.

## 2.2 Proposta de valor
- Estrutura simples para treino diario.
- Historico persistente de sessoes.
- Relacao instrutor-aluno com convites e regras de desvinculo.
- Controle de acesso em nivel de banco (RLS), reduzindo risco de vazamento de dados.

## 2.3 ICP (perfil de cliente ideal)
- Aluno de academia que quer registrar treino e evolucao.
- Instrutor que quer acompanhar e editar treino de alunos vinculados.

## 2.4 Modelo de crescimento (atual)
- Produto orientado a utilidade e retencao (uso recorrente).
- Canal primario: recomendacao de instrutores e alunos.

---

## 3. Regras de Negocio (estado atual)

## 3.1 Perfis
- Usuario escolhe tipo no cadastro: `aluno` ou `instrutor`.
- Papel fica em `public.profiles.role` (fonte de verdade).

## 3.2 Relacao instrutor-aluno
- Aluno pode ter somente 1 instrutor ativo por vez.
- Instrutor convida aluno por email.
- Aluno aceita convite por link/token.
- Instrutor pode visualizar e gerenciar treino do aluno vinculado.
- Historico pode permanecer visivel ao instrutor apos encerramento da vinculacao (regra suportada).

## 3.3 Desvinculacao
- Aluno pode solicitar desvinculo.
- Dependendo da flag `student_can_unlink`, o desvinculo:
  - encerra direto, ou
  - gera solicitacao pendente para aprovacao do instrutor.

## 3.4 Governanca de treino
- Se aluno nao tem instrutor ativo: pode criar/editar/excluir treino.
- Se aluno tem instrutor ativo: alteracao estrutural de treino e bloqueada por RLS.
- Instrutor ativo do aluno pode criar/editar/excluir treinos daquele aluno.

---

## 4. Arquitetura Tecnica

## 4.1 Visao de alto nivel
- Cliente React conversa diretamente com Supabase.
- Auth via JWT do Supabase.
- Seguranca de acesso no Postgres via RLS.
- Logica de fluxo sensivel implementada em:
  - funcoes SQL (RPC)
  - Edge Function (`send-coach-invite`)

## 4.2 Frontend
Principais blocos:
- `src/App.tsx`: roteamento e bootstrap global.
- `src/components/ProtectedRoute.tsx`: guardas por autenticacao, papel e capacidade de gerenciar treino.
- Stores Zustand:
  - `useAuthStore`: sessao, role, contexto de vinculacao.
  - `useWorkoutStore`: CRUD de treinos/itens, offline queue.
  - `useSessionStore`: sessao ativa, timer, sync de sessao.
  - `useHistoryStore`: leitura de historico finalizado.

## 4.3 Backend (Supabase)
- Auth: usuarios e sessao.
- DB Postgres: tabelas de negocio + politicas RLS.
- RPCs para fluxos de convite/desvinculo.
- Edge Function para envio de convite por email.

## 4.4 PWA e offline
- Service Worker custom (`src/sw.ts`) com `vite-plugin-pwa` (`injectManifest`).
- Filas locais de sync para operacoes offline (workouts/sessions).
- Banner offline no app e processamento de fila ao voltar conexao.

---

## 5. Mapa Funcional (rotas)

Publicas:
- `/login`
- `/register`
- `/register-confirmation`
- `/forgot-password`
- `/reset-password`

Protegidas (autenticado):
- `/` (home)
- `/workout/:workoutId`
- `/history`
- `/archive`
- `/profile`
- `/about`
- `/accept-invite`

Protegidas com `requireWorkoutManage`:
- `/workout/:workoutId/edit`

Apenas instrutor:
- `/coach-panel`
- `/coach-student-workouts`
- `/coach-invites`
- `/coach-unlink-requests`

---

## 6. Modelo de Dados (resumo pratico)

Tabelas centrais de treino:
- `workouts`
- `workout_items`
- `workout_sessions`
- `session_items`

Tabela de identidade de dominio:
- `profiles` (`role`, `full_name`, `first_name`, `last_name`, `gym_name`)

Tabelas de relacionamento instrutor-aluno:
- `coach_student_links`
- `coach_student_invites`
- `coach_student_unlink_requests`

SQL de referencia:
- `sql/000_only_training_consolidated.sql` (estado consolidado)
- migracoes incrementais em `sql/2026-02-12_*.sql`

---

## 7. Seguranca e Compliance Tecnica

## 7.1 Controle de acesso
- RLS habilitado nas tabelas de negocio.
- Policies baseadas em `auth.uid()` + funcoes auxiliares.
- Regras de cross-user so liberadas quando existe vinculacao valida.

## 7.2 Convites
- Token nao e salvo em claro (hash no banco).
- Convite e vinculado ao email do aluno.
- Validacoes de expiracao e status no aceite.

## 7.3 Observacao importante
- Mudancas em RLS devem sempre passar por teste funcional de:
  - aluno sem instrutor
  - aluno com instrutor ativo
  - instrutor com aluno vinculado

---

## 8. API e Integracoes

## 8.1 RPCs principais
- `create_coach_invite(student_email_input, expires_in_hours)`
- `accept_coach_invite(token_input)`
- `request_student_unlink(link_id_input, message_input)`
- `resolve_unlink_request(request_id_input, approve_input)`

## 8.2 Edge Function
- `supabase/functions/send-coach-invite/index.ts`
- Funcao:
  - chama RPC para criar convite
  - monta link de aceite
  - envia email via Resend (quando configurado)
  - faz fallback retornando link para envio manual

Secrets relevantes:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (opcional para envio real)
- `COACH_INVITE_FROM`
- `APP_BASE_URL`

---

## 9. Design e UX

Principios de interface atuais:
- Mobile-first com layout simples e alta legibilidade.
- Feedback claro de estado (loading, erro, sucesso).
- Fluxo de treino com baixa friccao.
- Acoes sensiveis com confirmacao.

Pontos de design system:
- Componentes UI em `src/components/ui/*`
- Idiomas: `pt` e `en` (i18n)
- Tema claro/escuro via store (`useThemeStore`)

---

## 10. Estrategia de Produto

## 10.1 Norte
Ser o app mais simples e confiavel para rotina de treino aluno-instrutor.

## 10.2 KPIs recomendados
- Ativacao:
  - % usuarios que criam ou recebem 1 treino no dia 0
- Engajamento:
  - sessoes finalizadas por usuario por semana
- Retencao:
  - D7 / D30 por papel
- Valor para instrutor:
  - media de alunos ativos por instrutor
- Qualidade:
  - taxa de erro por endpoint/RPC

## 10.3 Roadmap sugerido (macro)
1. Estabilizacao operacional
2. Observabilidade e metricas de produto
3. Melhorias de UX do instrutor (escala de alunos)
4. Recursos premium (templates, relatorios, exportacoes)

---

## 11. Operacao e Gestao do Projeto

## 11.1 Ambientes e deploy
Comandos:
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run deploy`

Deploy atual:
- Build estatico para GitHub Pages.

## 11.2 Processo de mudanca
Checklist minimo por feature:
1. Definir regra de negocio
2. Avaliar impacto em RLS/DB
3. Implementar UI + store + rota
4. Atualizar i18n PT/EN
5. Atualizar SQL/migracao quando necessario
6. Rodar build e smoke tests manuais
7. Atualizar documentacao

## 11.3 Definicao de pronto (DoD)
- Regra de negocio implementada
- Sem quebra de permissao
- Build ok
- Fluxo manual validado
- Documentacao atualizada

## 11.4 Riscos tecnicos atuais
- Complexidade crescente de RLS/policies.
- Dependencia de validacao manual de fluxo multi-papel.
- Possivel divergencia entre docs antigas e estado atual.

Mitigacao:
- Tratar este guia como documento canonical de onboarding.
- Sempre refletir mudancas relevantes aqui e no SQL consolidado.

---

## 12. Onboarding Rapido (30-60 minutos)

1. Ler este arquivo inteiro.
2. Ler `AGENTS.md`.
3. Ler `sql/000_only_training_consolidated.sql` (tabelas e policies).
4. Rodar app local e testar fluxos:
   - cadastro/login
   - criar treino
   - iniciar/finalizar sessao
   - fluxo instrutor-aluno (convite e aceite)
5. Revisar `src/App.tsx` e `src/components/ProtectedRoute.tsx`.
6. Revisar stores principais (`auth`, `workout`, `session`, `history`).

---

## 13. Arquivos-Chave

Produto e app:
- `src/App.tsx`
- `src/pages/*`
- `src/components/ProtectedRoute.tsx`

Estado:
- `src/stores/useAuthStore.ts`
- `src/stores/useWorkoutStore.ts`
- `src/stores/useSessionStore.ts`
- `src/stores/useHistoryStore.ts`

Dados e backend:
- `src/lib/supabase.ts`
- `src/types/database.types.ts`
- `sql/000_only_training_consolidated.sql`
- `supabase/functions/send-coach-invite/index.ts`

Configuracao:
- `package.json`
- `vite.config.ts`
- `.env` (variaveis do Supabase)

---

## 14. Glossario

- RLS: Row Level Security (seguranca por linha no Postgres).
- RPC: funcao SQL chamada via Supabase.
- PWA: app web com capacidades offline e instalavel.
- Vinculacao: relacao ativa entre instrutor e aluno.

---

## 15. Notas Finais

Este documento foi escrito para ser a referencia principal de gestao e onboarding.
Se houver conflito entre documentos, priorize:
1. codigo em producao
2. SQL consolidado
3. este guia
4. demais docs legadas

Ultima atualizacao: 2026-02-12
