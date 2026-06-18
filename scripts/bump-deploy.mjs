// Sobe o PATCH da versão automaticamente antes de cada deploy no gh-pages.
// Disparado pelo script "predeploy" do package.json.
//
// Regras de versionamento (semver major.minor.patch):
//   - patch -> automático aqui, a cada `npm run deploy`            (ex.: 1.4.0 -> 1.4.1)
//   - minor -> manual via `npm run release:minor`                 (ex.: 1.4.1 -> 1.5.0)
//   - major -> manual via `npm run release:major`                 (ex.: 1.5.0 -> 2.0.0)
//
// O bump é commitado (sem tag) para o git continuar sendo a fonte de verdade.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
const pkgVersion = () => JSON.parse(readFileSync('./package.json', 'utf8')).version

const before = pkgVersion()

// Edita package.json (+ package-lock.json) sem criar commit/tag automático.
run('npm version patch --no-git-tag-version')

const after = pkgVersion()

// Commit só dos arquivos de versão, sem varrer outras mudanças do working tree.
run('git add package.json package-lock.json')
run(`git commit -m "chore: release v${after} [deploy]"`)

console.log(`\n✓ Versão: ${before} -> ${after} (exibida no Sobre do app)\n`)
