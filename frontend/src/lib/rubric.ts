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
