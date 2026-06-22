import { readFileSync, writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')

// Intentionally dark-by-design (auth) screens — skip.
const SKIP = ['Login.tsx', 'ForgotPassword.tsx']

const files = [
  'src/pages/Home.tsx',
  'src/pages/Workouts.tsx',
  'src/pages/Profile.tsx',
  'src/pages/History.tsx',
  'src/pages/WorkoutEditor.tsx',
  'src/pages/WorkoutSession.tsx',
  'src/pages/Register.tsx',
  'src/pages/RegisterConfirmation.tsx',
  'src/pages/CoachPanel.tsx',
  'src/pages/CoachInvites.tsx',
  'src/pages/CoachStudentWorkouts.tsx',
  'src/pages/CoachUnlinkRequests.tsx',
  'src/components/WorkoutCard.tsx',
  'src/components/MuscleWikiSearch.tsx',
  'src/components/ui/input.tsx',
].filter((f) => !SKIP.some((s) => f.endsWith(s)))

// token -> dark variant to append. Only the "base" (non-prefixed) utility.
const MAP = {
  'bg-white': 'dark:bg-ot-dark-card',
  'bg-neutral-50': 'dark:bg-neutral-900',
  'bg-neutral-100': 'dark:bg-neutral-800',
  'text-neutral-900': 'dark:text-neutral-50',
  'text-neutral-800': 'dark:text-neutral-100',
  'text-neutral-700': 'dark:text-neutral-300',
  'text-neutral-600': 'dark:text-neutral-400',
  'text-neutral-500': 'dark:text-neutral-400',
  'border-neutral-200': 'dark:border-neutral-800',
  'border-neutral-100': 'dark:border-neutral-800',
}

let total = 0
for (const file of files) {
  let src
  try { src = readFileSync(file, 'utf8') } catch { console.log('skip (missing):', file); continue }
  let out = src
  let fileCount = 0
  for (const [base, dark] of Object.entries(MAP)) {
    // match base token not preceded by ':' or '-' (avoid dark:bg-white, hover:bg-white-ish),
    // not followed by word/-/ '/ ' (avoid bg-white/80, bg-neutral-500/x, and longer tokens)
    const re = new RegExp(`(?<![\\w:/-])${base}(?![\\w/-])`, 'g')
    out = out.replace(re, (m, offset, str) => {
      // skip if the matching className group already contains the dark variant
      // (cheap heuristic: look 80 chars around for the dark token)
      const ctx = str.slice(Math.max(0, offset - 90), offset + 90)
      if (ctx.includes(dark)) return m
      fileCount++
      return `${m} ${dark}`
    })
  }
  if (fileCount) {
    total += fileCount
    console.log(`${file}: ${fileCount} edits`)
    if (APPLY) writeFileSync(file, out)
  }
}
console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'} total edits: ${total}`)
