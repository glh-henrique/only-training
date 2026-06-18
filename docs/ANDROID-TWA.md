# OnlyTraining — Android (TWA / APK)

Empacotamento da PWA como app Android via **Trusted Web Activity (TWA)** usando Bubblewrap.
A PWA continua sendo a fonte única: qualquer deploy no site atualiza o app automaticamente.

- **PWA / domínio:** https://only-training.guilhermehricardo.com/
- **applicationId:** `com.guilhermehricardo.onlytraining`
- **Estratégia:** manter web + Android com a mesma base de código.

---

## Pré-requisitos (máquina de build)

- Node.js + `@bubblewrap/cli` (`npm i -g @bubblewrap/cli`)
- JDK 17 e Android SDK — o Bubblewrap instala/baixa o que faltar no primeiro `init`.
- Alternativa sem setup: https://www.pwabuilder.com (usa Bubblewrap por baixo).

---

## Fase 1 — Endurecer PWA  ✅ FEITO
- Manifest com `id`, `orientation`, `categories`, `lang: pt-BR`, `start_url`, maskable icon.
- `index.html` com `theme-color` e `apple-touch-icon`.
- TODO(T2): trocar `public/pwa-maskable-512x512.png` (hoje é cópia do 512) por um
  PNG maskable real com safe-zone (~80% central). Gerar em https://maskable.app

## Fase 2 — Gerar AAB/APK
```bash
bubblewrap init --manifest https://only-training.guilhermehricardo.com/manifest.webmanifest
# Confirmar: applicationId = com.guilhermehricardo.onlytraining, nome, cor de splash, versão
bubblewrap build
# Saídas: app-release-bundle.aab (Play Store)  +  app-release-signed.apk (testes)
```

> ⚠️ KEYSTORE: o `init` gera (ou usa) uma keystore de assinatura. **Faça backup seguro**
> (cofre/secret manager). Perdê-la = não conseguir mais atualizar o app na Play Store.
> NUNCA commitar a keystore neste repositório.

## Fase 3 — Digital Asset Links
1. Pegar o SHA-256 da keystore:
   ```bash
   keytool -list -v -keystore android.keystore -alias android
   ```
2. Colar o fingerprint em `public/.well-known/assetlinks.json` (substituir o placeholder).
3. Deploy (`npm run deploy`) e validar:
   https://developers.google.com/digital-asset-links/tools/generator
   Sem isso, a TWA abre com a barra de URL do navegador.

## Fase 4 — Testar em device
```bash
adb install app-release-signed.apk
```
Checar: login Supabase, rotas (react-router), sessão persistida, fluxo coach/aluno,
upload de foto, botão voltar do Android, splash.

## Fase 5 — Play Store
- Conta Google Play Developer (US$25, taxa única).
- Política de Privacidade (URL obrigatória — há dados pessoais via Supabase).
- Screenshots + descrição + classificação de conteúdo.
- Upload do `.aab` → teste interno → produção.

## Fase 6 — Manutenção
- Web: atualiza automático no deploy (nada a fazer no app).
- App: só republicar quando mudar config nativa (ícone, splash, permissões, versão).
