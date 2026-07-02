import { describe, it, expect } from 'vitest'
import { estimateDuration, computeStreak, computeLongestStreak } from './stats'

const day = (offset: number, base = new Date('2026-07-02T12:00:00')) => {
  const d = new Date(base)
  d.setDate(d.getDate() + offset)
  return { ended_at: d.toISOString() }
}

const TODAY = new Date('2026-07-02T15:00:00')

describe('estimateDuration', () => {
  it('retorna null sem itens', () => {
    expect(estimateDuration([])).toBeNull()
  })

  it('usa defaults de 3 séries e 60s de descanso', () => {
    // 3 × (40 + 60) = 300s = 5min
    expect(estimateDuration([{}])).toBe(5)
  })

  it('calcula com valores explícitos', () => {
    // 4 × (40 + 90) = 520s ≈ 9min
    expect(estimateDuration([{ default_sets: 4, rest_seconds: 90 }])).toBe(9)
  })
})

describe('computeStreak', () => {
  it('zero sem sessões', () => {
    expect(computeStreak([], TODAY)).toBe(0)
  })

  it('conta dias consecutivos terminando hoje', () => {
    expect(computeStreak([day(0), day(-1), day(-2)], TODAY)).toBe(3)
  })

  it('sequência terminando ontem continua valendo', () => {
    expect(computeStreak([day(-1), day(-2)], TODAY)).toBe(2)
  })

  it('quebra em dia sem treino', () => {
    expect(computeStreak([day(0), day(-2), day(-3)], TODAY)).toBe(1)
  })

  it('sequência que terminou anteontem não conta', () => {
    expect(computeStreak([day(-2), day(-3)], TODAY)).toBe(0)
  })

  it('ignora sessões não finalizadas', () => {
    expect(computeStreak([{ ended_at: null }], TODAY)).toBe(0)
  })

  it('sessões duplicadas no mesmo dia contam uma vez', () => {
    expect(computeStreak([day(0), day(0), day(-1)], TODAY)).toBe(2)
  })
})

describe('computeLongestStreak', () => {
  it('acha a maior sequência histórica', () => {
    const sessions = [day(-10), day(-9), day(-8), day(-7), day(0)]
    expect(computeLongestStreak(sessions, 1)).toBe(4)
  })

  it('nunca menor que a sequência atual', () => {
    expect(computeLongestStreak([], 5)).toBe(5)
  })
})
