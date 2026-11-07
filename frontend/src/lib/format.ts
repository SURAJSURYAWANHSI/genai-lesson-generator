import { CRITERIA, criterionLabel } from './rubric'
import type { Lesson, LessonSection, RunStatus } from './types'

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** "7 Nov 2026, 1:17 AM" */
export function formatDate(value: string): string {
  return dateFormat.format(new Date(value)).replace(/\b(am|pm)\b/, (part) => part.toUpperCase())
}

export function pluralise(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export const STATUS_WORDS: Record<RunStatus, string> = {
  PASS: 'Passed',
  REJECTED: 'Rejected',
  ERROR: 'Stopped with an error',
  RUNNING: 'Still running',
}

/** The run's outcome as a sentence, such as "Passed after 2 attempts". */
export function outcomeSentence(status: RunStatus, attempts: number): string {
  if (status === 'ERROR' || status === 'RUNNING') return STATUS_WORDS[status]
  return `${STATUS_WORDS[status]} after ${pluralise(attempts, 'attempt')}`
}

export function topicLabel(topicKey: string): string {
  if (topicKey === '*') return 'All topics'
  if (topicKey === 'rag') return 'RAG'
  const words = topicKey.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const SECTION_LABELS: Record<LessonSection, string> = {
  title: 'Title',
  introduction: 'Introduction',
  what_it_means: 'What it means',
  why_it_matters: 'Why it matters',
  important_components: 'Important components',
  step_by_step_process: 'Step-by-step process',
  real_world_analogy: 'Real-world analogy',
  practical_example: 'Practical example',
  example_walkthrough: 'Example walkthrough',
  terminology: 'Terminology',
  common_mistakes: 'Common mistakes',
  summary: 'Summary',
  key_takeaways: 'Key takeaways',
  knowledge_check_questions: 'Knowledge check questions',
  knowledge_check_answers: 'Knowledge check answers',
}

export const LESSON_SECTIONS = Object.keys(SECTION_LABELS) as LessonSection[]

export function sectionLabel(section: string): string {
  return SECTION_LABELS[section as LessonSection] ?? section.replace(/_/g, ' ')
}

export function changedSections(before: Lesson, after: Lesson): LessonSection[] {
  return LESSON_SECTIONS.filter((name) => JSON.stringify(before[name]) !== JSON.stringify(after[name]))
}

const OUTCOME_PHRASES: [RegExp, string][] = [
  [/with status PASS/g, 'as Passed'],
  [/with status REJECTED/g, 'as Rejected'],
  [/with status ERROR/g, 'with an error'],
  [/generation\(s\)/g, 'attempt(s)'],
  [/'rag'/g, 'RAG'],
  [/Deterministic validator:/g, 'Automatic check:'],
  [/Model evidence: \[Mock rule-based check\]/g, 'Mock check:'],
  [/Model evidence:/g, 'Model check:'],
  [/\[Mock rule-based check\]/g, 'Mock check:'],
]

/**
 * Backend text is written for logs and can name internals, such as 'example_walkthrough' or a bare
 * Q07. This turns those into the words used everywhere else in the UI.
 */
export function plainText(text: string): string {
  let result = text.replace(/'?\b[a-z]+(?:_[a-z]+)+\b'?/g, (match) => sectionLabel(match.replace(/'/g, '')))
  // The lookbehind leaves an already formatted "Practical Example (Q07)" alone.
  result = result.replace(/(?<!\()\b(Q(?:0[1-9]|10))\b( [A-Z][a-z]+(?: [A-Z][a-z]+)*)?/g, (_, id: string, suffix?: string) => {
    const name = CRITERIA.find((item) => item.id === id)?.name
    return criterionLabel(id) + (suffix && suffix.trim() !== name ? suffix : '')
  })
  for (const [pattern, phrase] of OUTCOME_PHRASES) result = result.replace(pattern, phrase)
  return result
}
