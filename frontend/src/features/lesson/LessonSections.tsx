import type { ReactNode } from 'react'
import { CircleCheck, CircleSlash, TriangleAlert } from 'lucide-react'
import { LESSON_SECTIONS, sectionLabel } from '@/lib/format'
import { isRagTopic } from '@/lib/constants'
import type { Lesson, LessonSection, PracticalExample } from '@/lib/types'
import { Markdown } from './Markdown'

function EmptySection() {
  return (
    <p className="flex items-center gap-2 text-fail">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      This section is empty.
    </p>
  )
}

function ExampleField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 font-semibold">{label}</h4>
      {children}
    </div>
  )
}

/** The lesson model is generic. For a RAG topic these fields are the question, documents, prompt and answer. */
function PracticalExampleBody({ example, rag }: { example: PracticalExample; rag: boolean }) {
  const labels = rag
    ? { input: 'Question', sources: 'Documents', step: 'Prompt sent to the model', result: 'Answer' }
    : { input: 'Starting input', sources: 'Source materials', step: 'Intermediate step', result: 'Final result' }
  const missing = (
    <p className="text-sm text-fail">
      <TriangleAlert className="mr-1 inline size-4" aria-hidden />
      Missing.
    </p>
  )
  return (
    <div className="space-y-4">
      {example.scenario ? <Markdown>{example.scenario}</Markdown> : missing}
      <ExampleField label={labels.input}>
        {example.starting_input ? <Markdown>{example.starting_input}</Markdown> : missing}
      </ExampleField>
      <ExampleField label={labels.sources}>
        {example.source_materials.length === 0 ? (
          missing
        ) : (
          <ul className="space-y-2">
            {example.source_materials.map((material) => {
              const selected = example.selected_materials.includes(material.title)
              return (
                <li
                  key={material.title}
                  className={`rounded-md border p-3 ${selected ? 'border-primary' : ''}`}
                >
                  <p className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                    {material.title}
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {selected ? (
                        <CircleCheck className="size-3.5" aria-hidden />
                      ) : (
                        <CircleSlash className="size-3.5" aria-hidden />
                      )}
                      {selected ? 'Selected' : 'Not selected'}
                    </span>
                  </p>
                  <Markdown>{material.content}</Markdown>
                </li>
              )
            })}
          </ul>
        )}
      </ExampleField>
      <ExampleField label={labels.step}>
        {example.intermediate_step ? (
          <p className="rounded-md bg-muted px-4 py-3 whitespace-pre-wrap">
            {example.intermediate_step}
          </p>
        ) : (
          missing
        )}
      </ExampleField>
      <ExampleField label={labels.result}>
        {example.final_result ? <Markdown>{example.final_result}</Markdown> : missing}
      </ExampleField>
    </div>
  )
}

export function SectionBody({ lesson, section, rag }: { lesson: Lesson; section: LessonSection; rag: boolean }) {
  switch (section) {
    case 'title':
      return lesson.title ? <p className="text-2xl font-semibold tracking-tight">{lesson.title}</p> : <EmptySection />
    case 'introduction':
    case 'what_it_means':
    case 'why_it_matters':
    case 'real_world_analogy':
    case 'summary':
      return lesson[section] ? <Markdown>{lesson[section]}</Markdown> : <EmptySection />
    case 'important_components':
      if (!lesson.important_components.length) return <EmptySection />
      return (
        <dl className="space-y-3">
          {lesson.important_components.map((item) => (
            <div key={item.name}>
              <dt className="font-semibold">{item.name}</dt>
              <dd>
                <Markdown>{item.explanation}</Markdown>
              </dd>
            </div>
          ))}
        </dl>
      )
    case 'step_by_step_process':
      if (!lesson.step_by_step_process.length) return <EmptySection />
      return (
        <ol className="space-y-3">
          {lesson.step_by_step_process.map((step) => (
            <li key={step.step_number} className="grid grid-cols-[2rem_1fr] gap-1">
              <span className="font-semibold tabular-nums">{step.step_number}.</span>
              <div className="min-w-0">
                <p className="font-semibold">{step.title}</p>
                <Markdown>{step.explanation}</Markdown>
              </div>
            </li>
          ))}
        </ol>
      )
    case 'practical_example':
      return <PracticalExampleBody example={lesson.practical_example} rag={rag} />
    case 'example_walkthrough':
      if (!lesson.example_walkthrough.length) return <EmptySection />
      return (
        <ol className="space-y-3">
          {lesson.example_walkthrough.map((step) => (
            <li key={step.step_number} className="grid grid-cols-[2rem_1fr] gap-1">
              <span className="font-semibold tabular-nums">{step.step_number}.</span>
              <div className="min-w-0 space-y-1">
                <Markdown>{step.action}</Markdown>
                <div className="text-muted-foreground">
                  <Markdown>{step.result}</Markdown>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )
    case 'terminology':
      if (!lesson.terminology.length) return <EmptySection />
      return (
        <dl className="space-y-3">
          {lesson.terminology.map((item) => (
            <div key={item.term}>
              <dt className="font-semibold">{item.term}</dt>
              <dd>
                <Markdown>{item.simple_explanation}</Markdown>
              </dd>
            </div>
          ))}
        </dl>
      )
    case 'common_mistakes':
      if (!lesson.common_mistakes.length) return <EmptySection />
      return (
        <ul className="space-y-3">
          {lesson.common_mistakes.map((item) => (
            <li key={item.misconception}>
              <p className="font-semibold">{item.misconception}</p>
              <Markdown>{item.correction}</Markdown>
            </li>
          ))}
        </ul>
      )
    case 'key_takeaways':
      if (!lesson.key_takeaways.length) return <EmptySection />
      return (
        <ul className="list-disc space-y-1 pl-5">
          {lesson.key_takeaways.map((item) => (
            <li key={item}>
              <Markdown>{item}</Markdown>
            </li>
          ))}
        </ul>
      )
    case 'knowledge_check_questions':
      if (!lesson.knowledge_check_questions.length) return <EmptySection />
      return (
        <ol className="space-y-2">
          {lesson.knowledge_check_questions.map((item) => (
            <li key={item.number} className="grid grid-cols-[2rem_1fr] gap-1">
              <span className="font-semibold tabular-nums">{item.number}.</span>
              <Markdown>{item.question}</Markdown>
            </li>
          ))}
        </ol>
      )
    case 'knowledge_check_answers':
      if (!lesson.knowledge_check_answers.length) return <EmptySection />
      return (
        <ol className="space-y-2">
          {lesson.knowledge_check_answers.map((item) => (
            <li key={item.number} className="grid grid-cols-[2rem_1fr] gap-1">
              <span className="font-semibold tabular-nums">{item.number}.</span>
              <Markdown>{item.answer}</Markdown>
            </li>
          ))}
        </ol>
      )
  }
}

/** All 15 sections in teaching order. The title reads as the lesson's heading, not a labelled section. */
export function LessonSections({ lesson, topic }: { lesson: Lesson; topic: string }) {
  const rag = isRagTopic(topic)
  return (
    <div className="space-y-10">
      {LESSON_SECTIONS.map((section) =>
        section === 'title' ? (
          <SectionBody key={section} lesson={lesson} section={section} rag={rag} />
        ) : (
          <section key={section}>
            <h3 className="mb-3 text-xl font-semibold tracking-tight">{sectionLabel(section)}</h3>
            <SectionBody lesson={lesson} section={section} rag={rag} />
          </section>
        ),
      )}
    </div>
  )
}
