// Estimativa de gasto calórico do treino.
// Valores MET do Compendium of Physical Activities (Ainsworth et al., 2011).
// Fórmula com FC: Keytel et al., 2005 (sem VO2max, erro ~±15%).

export type Sex = 'male' | 'female'

export const MET_VALUES = {
  strength_light: 3.5,
  strength_moderate: 5.0,
  strength_vigorous: 6.0,
  walking: 3.5,
  running: 8.0,
  cycling: 7.0,
} as const

// RPE (1-10) → MET de musculação
export function metFromRpe(rpe: number): number {
  if (rpe <= 3) return MET_VALUES.strength_light
  if (rpe <= 6) return MET_VALUES.strength_moderate
  return MET_VALUES.strength_vigorous
}

// Gasto líquido do treino: (MET − 1) desconta o basal já embutido no MET.
export function estimateCaloriesMet(met: number, weightKg: number, durationSeconds: number): number {
  return (met - 1) * weightKg * (durationSeconds / 3600)
}

// Keytel et al. 2005 — kcal a partir da FC média. Gasto bruto (inclui basal),
// mas é medição indireta real; não subtraímos o basal aqui.
export function estimateCaloriesKeytel(params: {
  avgHeartRate: number
  weightKg: number
  age: number
  sex: Sex
  durationSeconds: number
}): number {
  const { avgHeartRate, weightKg, age, sex, durationSeconds } = params
  const kcalPerMin = sex === 'male'
    ? (-55.0969 + 0.6309 * avgHeartRate + 0.1988 * weightKg + 0.2017 * age) / 4.184
    : (-20.4022 + 0.4472 * avgHeartRate - 0.1263 * weightKg + 0.074 * age) / 4.184
  return Math.max(0, kcalPerMin) * (durationSeconds / 60)
}

// % de gordura corporal — método US Navy (medidas em cm). null se faltar medida.
export function bodyFatNavy(params: {
  sex: Sex
  heightCm: number
  neckCm: number
  waistCm: number
  hipCm?: number | null
}): number | null {
  const { sex, heightCm, neckCm, waistCm, hipCm } = params
  const log10 = Math.log10
  let bf: number
  if (sex === 'male') {
    if (waistCm - neckCm <= 0) return null
    bf = 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450
  } else {
    if (!hipCm || waistCm + hipCm - neckCm <= 0) return null
    bf = 495 / (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.221 * log10(heightCm)) - 450
  }
  return bf > 0 && bf < 75 ? bf : null
}

// Gasto basal diário (kcal). Com % de gordura usa Katch-McArdle (massa magra);
// senão Mifflin-St Jeor (peso, altura, idade, sexo). null se faltar dado.
export function basalMetabolicRate(params: {
  weightKg: number
  heightCm?: number | null
  age?: number | null
  sex?: Sex | null
  bodyFatPercent?: number | null
}): number | null {
  const { weightKg, heightCm, age, sex, bodyFatPercent } = params
  if (bodyFatPercent != null) {
    const leanMassKg = weightKg * (1 - bodyFatPercent / 100)
    return 370 + 21.6 * leanMassKg
  }
  if (heightCm && age != null && sex) {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
  }
  return null
}

export function ageFromBirthDate(birthDate: string, today = new Date()): number {
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const beforeBirthday = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age
}
