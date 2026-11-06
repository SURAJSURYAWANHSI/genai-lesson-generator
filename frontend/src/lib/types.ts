// Mirrors backend/app/schemas/api.py and the untyped dicts from memory_store.py, evolution.py
// and run_repository.get_stats. Lesson mirrors backend/app/schemas/lesson.py.

export type RunStatus = 'RUNNING' | 'PASS' | 'REJECTED' | 'ERROR'
export type CheckStatus = 'PASS' | 'FAIL'
export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ROLLED_BACK'
export type EnglishLevel = 'basic' | 'intermediate' | 'advanced'
export type TechnicalLevel = 'beginner' | 'intermediate' | 'advanced'
export type FeedbackRating = 'approve' | 'needs_changes' | 'reject'

export interface LessonComponent {
  name: string
  explanation: string
}
export interface ProcessStep {
  step_number: number
  title: string
  explanation: string
}
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
export interface WalkthroughStep {
  step_number: number
  action: string
  result: string
}
export interface TermDefinition {
  term: string
  simple_explanation: string
}
export interface Misconception {
  misconception: string
  correction: string
}
export interface KnowledgeQuestion {
  number: number
  question: string
}
export interface KnowledgeAnswer {
  number: number
  answer: string
}
export interface Lesson {
  title: string
  introduction: string
  what_it_means: string
  why_it_matters: string
  important_components: LessonComponent[]
  step_by_step_process: ProcessStep[]
  real_world_analogy: string
  practical_example: PracticalExample
  example_walkthrough: WalkthroughStep[]
  terminology: TermDefinition[]
  common_mistakes: Misconception[]
  summary: string
  key_takeaways: string[]
  knowledge_check_questions: KnowledgeQuestion[]
  knowledge_check_answers: KnowledgeAnswer[]
}
export type LessonSection = keyof Lesson

export interface LearnerProfileInput {
  education?: string
  english_level?: EnglishLevel
  technical_level?: TechnicalLevel
}

export interface GenerateLessonRequest {
  topic: string
  learner_profile?: LearnerProfileInput
  max_retries?: number
  reference_material?: string | null
  demo_mode?: boolean
  error_injection?: string | null
  persistent_error?: boolean
}

export interface Check {
  criterion_id: string
  criterion_name: string
  status: CheckStatus
  evidence: string
  failure_reason: string | null
  suggested_correction: string | null
  affected_sections: string[]
  source: string
}

export interface DeterministicIssue {
  code: string
  criterion_id: string
  section: string
  message: string
  suggested_correction: string
}

export interface Evaluation {
  id: string
  attempt_number: number
  lesson_version_id: string
  status: string
  passed: boolean
  rubric_version: number | null
  prompt_version: number | null
  model_provider: string
  model_name: string
  deterministic_issues: DeterministicIssue[]
  llm_attempts: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number | null
  created_at: string
  checks: Check[]
}

export interface FailedCheck {
  criterion_id: string
  criterion_name: string
  evidence: string
  failure_reason: string | null
  suggested_correction: string | null
}

export interface FailedCriterionFeedback {
  criterion_id: string
  criterion_name: string
  evidence: string
  failure_reason: string
  suggested_correction: string
  instruction: string
  target_sections: string[]
}

export interface RevisionFeedback {
  attempt: number
  failed_criteria: FailedCriterionFeedback[]
  sections_to_revise: string[]
  sections_to_preserve: string[]
}

export interface Rejection {
  id: string
  run_id: string
  attempt: number
  lesson_version: number
  status: string
  failed_criterion_ids: string[]
  failed_checks: FailedCheck[]
  generator_feedback: RevisionFeedback | null
  previous_lesson: Lesson
  revised_lesson: Lesson | null
  revised_version: number | null
  created_at: string
}

export interface LessonVersion {
  id: string
  version: number
  attempt_number: number
  content: Lesson
  content_hash: string
  source: string
  is_injected: boolean
  injected_error_type: string | null
  changed_sections: string[]
  is_final: boolean
  model_provider: string
  model_name: string
  prompt_version: number | null
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number | null
  created_at: string
}

export interface InjectionModification {
  attempt: number
  section: string
  before: unknown
  after: unknown
  description: string
}

export interface InjectionEvaluatorResult {
  attempt: number
  lesson_had_injected_error: boolean
  failed_criteria: string[]
}

export interface ErrorInjectionRecord {
  type: string
  label: string
  expected_criteria: string[]
  persistent: boolean
  modifications: InjectionModification[]
  evaluator_results: InjectionEvaluatorResult[]
  detected: boolean | null
  corrected: boolean | null
}

export interface GenerateLessonResponse {
  run_id: string
  status: RunStatus
  attempts: number
  final_lesson: Lesson | null
  evaluation: Evaluation | null
  rejection_log: Rejection[]
  memory_used: boolean
  error_message: string | null
  error_injection: ErrorInjectionRecord | null
}

export interface RunSummary {
  run_id: string
  topic: string
  status: RunStatus
  attempts: number
  max_attempts: number
  demo_mode: boolean
  memory_used: boolean
  model_provider: string
  model_name: string
  created_at: string
  completed_at: string | null
}

export interface MemorySnapshot {
  generator_guidance: string[]
  evaluator_notes: string[]
  record_ids: string[]
  used: boolean
}

export interface RunDetail extends RunSummary {
  learner_profile: Record<string, string>
  error_message: string | null
  error_injection: ErrorInjectionRecord | null
  memory_snapshot: MemorySnapshot | null
  reference_source: string
  reference_chars: number
  evaluator_provider: string
  evaluator_model: string
  prompt_version: number | null
  evaluator_prompt_version: number | null
  rubric_version: number | null
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number | null
  final_lesson: Lesson | null
  final_version: number | null
  latest_lesson: Lesson | null
  latest_version: number | null
  evaluation: Evaluation | null
  rejection_count: number
}

export interface HistoryResponse {
  total: number
  items: RunSummary[]
}

export interface FeedbackRequest {
  rating: FeedbackRating
  comment: string
  criterion_id?: string | null
  reviewer?: string
}

export interface FeedbackOut {
  id: string
  run_id: string
  topic_key: string
  rating: FeedbackRating
  comment: string
  criterion_id: string | null
  reviewer: string
  created_at: string
}

export interface ProposalEvidence {
  count?: number
  demo_failures?: number
  organic_failures?: number
  runs_affected?: number
  demo_occurrences?: number
  runs?: number
  failure_rate?: number
  top_criterion?: string
  rejected_runs?: number
}

export interface Proposal {
  id: string
  proposal_type: string
  target: string
  criterion_id: string | null
  topic_key: string | null
  title: string
  proposed_change: string
  rationale: string
  evidence: ProposalEvidence
  status: ProposalStatus
  previous_version: number | null
  resulting_version: number | null
  baseline_metrics: { total_runs: number; criterion_failures: number } | null
  decided_by: string | null
  decision_note: string | null
  decided_at: string | null
  created_at: string
}

export interface PromptVersion {
  id: string
  name: string
  version: number
  content: string
  is_active: boolean
  change_summary: string
  source_proposal_id: string | null
  created_by: string
  created_at: string
}

export interface ErrorType {
  key: string
  label: string
  description: string
  expected_criteria: string[]
  rag_only: boolean
}

export interface Health {
  status: 'ok' | 'degraded'
  environment: string
  database: 'ok' | 'unavailable'
  generator_provider: string
  generator_model: string
  evaluator_provider: string
  evaluator_model: string
  mock_mode: boolean
  demo_allowed: boolean
  error_types: ErrorType[]
}

export interface Stats {
  total_runs: number
  passing_lessons: number
  rejected_lessons: number
  errored_runs: number
  running: number
  average_attempts: number | null
  rubric_failures: { criterion_id: string; criterion_name: string; failures: number }[]
  recent_runs: RunSummary[]
}

export interface MemoryRecord {
  id: string
  memory_type: string
  topic_key: string
  criterion_id: string | null
  memory_key: string
  content: string
  occurrences: number
  demo_occurrences: number
  success_count: number
  is_active: boolean
  source_run_id: string | null
  details: { criterion_name?: string; affected_sections?: string[]; target_sections?: string[] } | null
  created_at: string
  updated_at: string
}

export interface MemoryPatterns {
  failure_patterns: MemoryRecord[]
  correction_strategies: MemoryRecord[]
  topic_patterns: MemoryRecord[]
  human_feedback: MemoryRecord[]
  active_prompt_versions: Record<string, number>
  active_rubric_version: number | null
}

export interface EvolutionAnalysis {
  total_runs: number
  demo_runs: number
  includes_demo_runs: boolean
  frequent_failures: {
    criterion_id: string
    criterion_name: string
    failures: number
    demo_failures: number
    runs_affected: number
  }[]
  content_weaknesses: { section: string; failures: number }[]
  regeneration_patterns: {
    attempts_distribution: Record<string, number>
    runs_needing_regeneration: number
    runs_finished: number
  }
  effective_strategies: {
    criterion_id: string
    strategy: string
    successes: number
    demo_occurrences: number
  }[]
  topic_failure_rates: {
    topic_key: string
    runs: number
    first_attempt_failures: number
    failure_rate: number
    top_criterion: string | null
  }[]
}

export interface PromptMetrics {
  prompt_version: number
  runs: number
  demo_runs: number
  pass_rate: number
  first_attempt_pass_rate: number
  average_attempts: number
  criterion_failures: Record<string, number>
}

/** One `stage` SSE event. Which optional fields appear depends on the node: see run_service._describe. */
export interface StageEvent {
  node: string
  event: 'start' | 'complete'
  attempt: number
  memory_used?: boolean
  guidance?: string[]
  injected?: boolean
  error?: string | null
  passed?: boolean
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
