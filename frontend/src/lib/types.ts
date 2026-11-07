// The API fields this UI reads. Sources: backend/app/schemas/api.py, schemas/lesson.py, and the
// untyped dicts from memory_store.py, evolution.py and run_repository.get_stats.

export type RunStatus = 'RUNNING' | 'PASS' | 'REJECTED' | 'ERROR'
export type CheckStatus = 'PASS' | 'FAIL'
export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ROLLED_BACK'
export type EnglishLevel = 'basic' | 'intermediate' | 'advanced'
export type TechnicalLevel = 'beginner' | 'intermediate' | 'advanced'

export interface SourceMaterial {
  title: string
  content: string
}
export interface PracticalExample {
  scenario: string
  starting_input: string
  source_materials: SourceMaterial[]
  selected_materials: string[]
  intermediate_step: string
  final_result: string
}
export interface Lesson {
  title: string
  introduction: string
  what_it_means: string
  why_it_matters: string
  important_components: { name: string; explanation: string }[]
  step_by_step_process: { step_number: number; title: string; explanation: string }[]
  real_world_analogy: string
  practical_example: PracticalExample
  example_walkthrough: { step_number: number; action: string; result: string }[]
  terminology: { term: string; simple_explanation: string }[]
  common_mistakes: { misconception: string; correction: string }[]
  summary: string
  key_takeaways: string[]
  knowledge_check_questions: { number: number; question: string }[]
  knowledge_check_answers: { number: number; answer: string }[]
}
export type LessonSection = keyof Lesson

export interface GenerateLessonRequest {
  topic: string
  learner_profile?: {
    education: string
    english_level: EnglishLevel
    technical_level: TechnicalLevel
  }
  max_retries?: number
  reference_material?: string | null
  demo_mode?: boolean
  error_injection?: string | null
}

export interface Check {
  criterion_id: string
  criterion_name: string
  status: CheckStatus
  evidence: string
  failure_reason: string | null
  suggested_correction: string | null
}

export interface Evaluation {
  id: string
  attempt_number: number
  passed: boolean
  checks: Check[]
}

export interface Rejection {
  id: string
  attempt: number
  lesson_version: number
  failed_criterion_ids: string[]
  failed_checks: Pick<Check, 'criterion_id' | 'criterion_name' | 'failure_reason'>[]
  generator_feedback: {
    failed_criteria: { criterion_id: string; instruction: string; suggested_correction: string }[]
    sections_to_revise: string[]
  } | null
  previous_lesson: Lesson
  revised_lesson: Lesson | null
  revised_version: number | null
}

export interface GenerateLessonResponse {
  run_id: string
  status: RunStatus
  attempts: number
  error_message: string | null
}

export interface RunSummary {
  run_id: string
  topic: string
  status: RunStatus
  attempts: number
  max_attempts: number
  created_at: string
}

export interface RunDetail extends RunSummary {
  error_message: string | null
  final_lesson: Lesson | null
  final_version: number | null
  latest_lesson: Lesson | null
  latest_version: number | null
  rejection_count: number
}

export interface HistoryResponse {
  items: RunSummary[]
}

export interface Proposal {
  id: string
  title: string
  proposed_change: string
  rationale: string
  evidence: {
    count?: number
    demo_failures?: number
    organic_failures?: number
    demo_occurrences?: number
  }
  status: ProposalStatus
  decided_by: string | null
  decided_at: string | null
}

export interface PromptVersion {
  id: string
  name: string
  version: number
  content: string
  is_active: boolean
  change_summary: string
}

export interface ErrorType {
  key: string
  label: string
  rag_only: boolean
}

export interface Health {
  status: 'ok' | 'degraded'
  database: 'ok' | 'unavailable'
  generator_provider: string
  evaluator_provider: string
  mock_mode: boolean
  demo_allowed: boolean
  error_types: ErrorType[]
}

export interface Stats {
  total_runs: number
  passing_lessons: number
  rejected_lessons: number
  average_attempts: number | null
  rubric_failures: { criterion_id: string; failures: number }[]
  recent_runs: RunSummary[]
}

export interface MemoryRecord {
  id: string
  memory_type: string
  topic_key: string
  criterion_id: string | null
  content: string
  occurrences: number
  success_count: number
  details: { criterion_name?: string } | null
}

export interface MemoryPatterns {
  failure_patterns: MemoryRecord[]
  correction_strategies: MemoryRecord[]
  topic_patterns: MemoryRecord[]
}

/** One `stage` SSE event. Which optional fields appear depends on the node: see run_service._describe. */
export interface StageEvent {
  node: string
  event: 'start' | 'complete'
  attempt: number
  memory_used?: boolean
  injected?: boolean
  error?: string | null
  failed_criteria?: string[]
  decision?: 'pass' | 'retry' | 'exhausted'
  sections_to_revise?: string[]
  final_status?: RunStatus
}

export type StreamEvent =
  | { type: 'started'; run_id: string; maximum_attempts: number }
  | { type: 'stage'; stage: StageEvent }
  | { type: 'complete'; result: GenerateLessonResponse }
  | { type: 'error'; message: string }
