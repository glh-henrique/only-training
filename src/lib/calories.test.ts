import { describe, it, expect } from 'vitest'
import { ageFromBirthDate, basalMetabolicRate, bodyFatNavy, estimateCaloriesKeytel, estimateCaloriesMet, metFromRpe } from './calories'

describe('calories', () => {
  it('metFromRpe maps intensity bands', () => {
    expect(metFromRpe(2)).toBe(3.5)
    expect(metFromRpe(5)).toBe(5.0)
    expect(metFromRpe(9)).toBe(6.0)
  })

  it('estimateCaloriesMet: net kcal, MET 5, 80kg, 1h = 320', () => {
    expect(estimateCaloriesMet(5, 80, 3600)).toBeCloseTo(320)
  })

  it('estimateCaloriesKeytel: male 30y 80kg HR140 60min ≈ 791 kcal', () => {
    const kcal = estimateCaloriesKeytel({ avgHeartRate: 140, weightKg: 80, age: 30, sex: 'male', durationSeconds: 3600 })
    expect(kcal).toBeGreaterThan(780)
    expect(kcal).toBeLessThan(800)
  })

  it('estimateCaloriesKeytel never returns negative', () => {
    const kcal = estimateCaloriesKeytel({ avgHeartRate: 40, weightKg: 50, age: 20, sex: 'female', durationSeconds: 3600 })
    expect(kcal).toBe(0)
  })

  it('bodyFatNavy: male 180cm neck 38 waist 85 ≈ 17-19%', () => {
    const bf = bodyFatNavy({ sex: 'male', heightCm: 180, neckCm: 38, waistCm: 85 })
    expect(bf).toBeGreaterThan(15)
    expect(bf).toBeLessThan(21)
  })

  it('bodyFatNavy: female requires hip; missing → null', () => {
    expect(bodyFatNavy({ sex: 'female', heightCm: 165, neckCm: 33, waistCm: 70 })).toBeNull()
    const bf = bodyFatNavy({ sex: 'female', heightCm: 165, neckCm: 33, waistCm: 70, hipCm: 95 })
    expect(bf).toBeGreaterThan(15)
    expect(bf).toBeLessThan(35)
  })

  it('basalMetabolicRate: Mifflin male 80kg 180cm 30y = 1780', () => {
    expect(basalMetabolicRate({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' })).toBeCloseTo(1780)
  })

  it('basalMetabolicRate: Katch-McArdle wins when body fat known', () => {
    // 80kg, 20% gordura → 64kg magra → 370 + 21.6×64 = 1752.4
    expect(basalMetabolicRate({ weightKg: 80, bodyFatPercent: 20 })).toBeCloseTo(1752.4)
  })

  it('basalMetabolicRate: missing data → null', () => {
    expect(basalMetabolicRate({ weightKg: 80 })).toBeNull()
  })

  it('ageFromBirthDate respects birthday not yet reached', () => {
    expect(ageFromBirthDate('1990-06-15', new Date('2026-07-09'))).toBe(36)
    expect(ageFromBirthDate('1990-12-25', new Date('2026-07-09'))).toBe(35)
  })
})
