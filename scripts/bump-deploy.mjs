// Sobe a versão automaticamente antes de cada deploy no gh-pages.
// Disparado pelo script "predeploy" do package.json.
//
// O nível (major/minor/patch) é derivado dos commits desde o último release,
// via Conventional Commits:
//   - "BREAKING CHANGE" ou "tipo!:" (ex.: feat!:)  -> major  (1.5.0 -> 2.0.0)
//   - "feat:" / "feat(scope):"                      -> minor  (1.4.1 -> 1.5.0)
//   - qualquer outra coisa                          -> patch  (1.4.0 -> 1.4.1)
// Override manual: BUMP=major|minor|patch node scripts/bump-deploy.mjs
//
// O bump é commitado (sem tag) para o git continuar sendo a fonte de verdade.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()
const pkgVersion = () => JSON.parse(readFileSync('./package.json', 'utf8')).version

// Commits desde o último release ("[deploy]"); fallback: últimos 50.
const tryOut = (cmd) => { try { return out(cmd) } catch { return '' } }
const lastRelease = tryOut('git log --grep="\\[deploy\\]" -n 1 --format=%H')
const range = lastRelease ? `${lastRelease}..HEAD` : '-n 50'
const log = out(`git log ${range} --format=%B`)

const level =
  process.env.BUMP ||
  (/(^|\n)\s*[a-z]+(\([^)]*\))?!:|BREAKING CHANGE/.test(log) ? 'major'
    : /(^|\n)\s*feat(\([^)]*\))?:/.test(log) ? 'minor'
    : 'patch')

const before = pkgVersion()

// Edita package.json (+ package-lock.json) sem criar commit/tag automático.
run(`npm version ${level} --no-git-tag-version`)

const after = pkgVersion()

// Commit só dos arquivos de versão, sem varrer outras mudanças do working tree.
run('git add package.json package-lock.json')
run(`git commit -m "chore: release v${after} [deploy]"`)

console.log(`\n✓ Versão (${level}): ${before} -> ${after} (exibida no Sobre do app)\n`)
