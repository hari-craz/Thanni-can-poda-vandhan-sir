import { QUALITY } from './constants'

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(date)
}

export function getQualityLevel(score: number): 'good' | 'warning' | 'critical' | 'emergency' {
  if (score >= QUALITY.GOOD) return 'good'
  if (score >= QUALITY.WARNING) return 'warning'
  if (score >= QUALITY.CRITICAL) return 'critical'
  return 'emergency'
}

export function getQualityLabel(score: number): string {
  const level = getQualityLevel(score)
  return level.charAt(0).toUpperCase() + level.slice(1)
}

export function getQualityColor(score: number): string {
  const level = getQualityLevel(score)
  const colors = { good: '#10B981', warning: '#F59E0B', critical: '#F97316', emergency: '#EF4444' }
  return colors[level]
}

export function formatNumber(value: number, decimals = 1): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(decimals)
}
