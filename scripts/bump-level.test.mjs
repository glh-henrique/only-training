// Self-check da regra de bump. Roda: node scripts/bump-level.test.mjs
import assert from 'node:assert/strict'

// Mesma lógica de bump-deploy.mjs (só a decisão de nível).
const level = (log, override) =>
  override ||
  (/(^|\n)\s*[a-z]+(\([^)]*\))?!:|BREAKING CHANGE/.test(log) ? 'major'
    : /(^|\n)\s*feat(\([^)]*\))?:/.test(log) ? 'minor'
    : 'patch')

assert.equal(level('fix: corrige bug'), 'patch')
assert.equal(level('chore: limpa deps'), 'patch')
assert.equal(level('feat: nova tela'), 'minor')
assert.equal(level('feat(home): card novo'), 'minor')
assert.equal(level('feat!: muda API'), 'major')
assert.equal(level('refactor(core)!: remove campo'), 'major')
assert.equal(level('fix: x\n\nBREAKING CHANGE: remove rota'), 'major')
assert.equal(level('feat: x', 'patch'), 'patch') // override manual ganha
assert.equal(level('feat: novo\nfix: bug'), 'minor') // múltiplos commits

console.log('✓ bump-level ok')
