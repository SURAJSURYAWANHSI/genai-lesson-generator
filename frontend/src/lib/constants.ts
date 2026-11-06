import type { GenerateLessonRequest } from './types'

export const DEFAULT_TOPIC = 'Introduction to RAG (Retrieval-Augmented Generation)'

export const DEMO_REQUEST: GenerateLessonRequest = {
  topic: DEFAULT_TOPIC,
  demo_mode: true,
  error_injection: 'missing_practical_example',
  max_retries: 2,
}

/** Same test as is_rag_topic in backend/app/prompts/topic_requirements.py. */
export function isRagTopic(topic: string): boolean {
  return /\brag\b|retrieval[\s-]*augmented/i.test(topic)
}
