export type BestStats = {
  score: number
  wave: number
  combo: number
}

const bestStatsKey = 'string-blade-best-stats'
const fallbackBestStats: BestStats = { score: 0, wave: 1, combo: 0 }

export const loadBestStats = (): BestStats => {
  try {
    const saved = localStorage.getItem(bestStatsKey)
    return saved ? { ...fallbackBestStats, ...JSON.parse(saved) } : fallbackBestStats
  } catch {
    return fallbackBestStats
  }
}

export const saveBestStats = (stats: BestStats) => {
  try {
    localStorage.setItem(bestStatsKey, JSON.stringify(stats))
  } catch {
    // Best stats are optional; gameplay should continue if storage is unavailable.
  }
}
