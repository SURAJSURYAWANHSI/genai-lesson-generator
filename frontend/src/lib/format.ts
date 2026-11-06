import type { Lesson, LessonSection } from './types'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function formatDate(value: string | null): string {
  return value ? dateFormat.format(new Date(value)) : 'Not finished'
}

/** A null cost means no pricing is configured for the model, which is not the same as free. */
export function formatCost(value: number | null): string {
  if (value === null) return 'not configured'
  return `$${value.toFixed(value !== 0 && value < 0.01 ? 4 : 2)}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatNumber(value: number): string {
  return value.toLocaleString()
}

export function topicLabel(topicKey: string): string {
  return topicKey === '*' ? 'All topics' : topicKey
}

export const SECTION_LABELS: Record<LessonSection, string> = {
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
  return SECTION_LABELS[section as LessonSection] ?? section
}

export function changedSections(before: Lesson, after: Lesson): LessonSection[] {
  return LESSON_SECTIONS.filter((name) => JSON.stringify(before[name]) !== JSON.stringify(after[name]))
}
