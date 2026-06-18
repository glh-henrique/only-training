# android/ — projeto TWA (Bubblewrap)

Empacotamento da PWA como app Android (Trusted Web Activity). Veja o passo a passo
completo em [`../docs/ANDROID-TWA.md`](../docs/ANDROID-TWA.md).

## O que é versionado
- **`twa-manifest.json`** — única fonte de verdade. Todo o resto desta pasta é
  regenerado a partir dele (`bubblewrap update` / `bubblewrap build`) e está no `.gitignore`.

## O que NÃO é versionado (e por quê)
- `android.keystore` — **segredo**. Perdê-la = nunca mais atualizar o app na Play Store.
  Mantenha backup em local seguro (cofre/secret manager), fora do git.
- `*.aab`, `*.apk`, `*.idsig` — saídas de build, regeráveis.
- `.gradle/`, `build/`, `app/`, `gradle/`, `gradlew*` — projeto Gradle gerado.
- `store_icon.png`, `manifest-checksum.txt` — gerados pelo Bubblewrap.

## Rebuild (a partir desta pasta)
```bash
cd android
bubblewrap build      # gera app-release-bundle.aab + app-release-signed.apk
```

## ⚠️ Atenção: package_id e assetlinks
- `packageId` atual: `com.guilhermehricardo.only_training.twa`
- Tem que ser **idêntico** ao `package_name` em
  `../public/.well-known/assetlinks.json`, senão a TWA abre com a barra de URL.
