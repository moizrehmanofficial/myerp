// Production order statuses, in the order they happen
export const MFG_STEPS = [
  { key: 'PLANNED', label: 'Planned' },
  { key: 'IN_PROGRESS', label: 'In production' },
  { key: 'COMPLETED', label: 'Completed' },
] as const

export function mfgStatusLabel(s?: string) {
  if (s === 'CANCELLED') return 'Cancelled'
  return MFG_STEPS.find((x) => x.key === s)?.label || s || '—'
}

export const MFG_TONE: Record<string, 'neutral' | 'info' | 'good' | 'bad'> = {
  PLANNED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'good',
  CANCELLED: 'bad',
}
