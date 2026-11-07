/** The ten mandatory criteria. The rubric's IDs and names are fixed: see backend/app/validators/rubric.py. */
export const CRITERIA = [
  { id: 'Q01', name: 'Accuracy' },
  { id: 'Q02', name: 'Beginner Friendliness' },
  { id: 'Q03', name: 'Jargon Explanation' },
  { id: 'Q04', name: 'What It Is' },
  { id: 'Q05', name: 'Why It Matters' },
  { id: 'Q06', name: 'How It Works' },
  { id: 'Q07', name: 'Practical Example' },
  { id: 'Q08', name: 'Teaching Flow' },
  { id: 'Q09', name: 'Standalone Completeness' },
  { id: 'Q10', name: 'Consistency' },
] as const

/** "Practical Example (Q07)": the name first, with the ID secondary. */
export function criterionLabel(id: string): string {
  const criterion = CRITERIA.find((item) => item.id === id)
  return criterion ? `${criterion.name} (${id})` : id
}

export function criterionList(ids: string[]): string {
  const labels = ids.map(criterionLabel)
  if (labels.length < 2) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}
