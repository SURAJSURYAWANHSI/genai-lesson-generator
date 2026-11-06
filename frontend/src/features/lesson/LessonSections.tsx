import { CircleCheck, CircleSlash, TriangleAlert } from 'lucide-react'
import { LESSON_SECTIONS, sectionLabel } from '@/lib/format'
import { isRagTopic } from '@/lib/constants'
import type { Lesson, LessonSection, PracticalExample } from '@/lib/types'
import { Markdown } from './Markdown'

function EmptySection() {
  return (
    <p className="flex items-center gap-2 rounded-md border border-dashed border-fail px-3 py-2 text-sm text-fail">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      This section is empty in this version.
    </p>
  )
}

function ExampleField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold">{label}</h4>
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
      Missing in this version.
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
          <ul className="grid gap-2 md:grid-cols-2">
            {example.source_materials.map((material) => {
              const selected = example.selected_materials.includes(material.title)
              return (
                <li
                  key={material.title}
                  className={`rounded-md border p-3 ${selected ? 'border-2 border-primary' : ''}`}
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
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm whitespace-pre-wrap">
            {example.intermediate_step}
          </pre>
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
      return lesson.title ? <p className="font-serif text-xl font-semibold">{lesson.title}</p> : <EmptySection />
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

/** All 15 sections in teaching order. The title is the first, as the backend counts it. */
export function LessonSections({ lesson, topic, idPrefix }: { lesson: Lesson; topic: string; idPrefix: string }) {
  const rag = isRagTopic(topic)
  return (
    <div className="space-y-8">
      {LESSON_SECTIONS.map((section, index) => (
        <section key={section} id={`${idPrefix}-${section}`} className="scroll-mt-4">
          <h3 className="mb-2 flex items-baseline gap-2 border-b pb-1.5 text-base font-semibold">
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{index + 1}</span>
            {sectionLabel(section)}
          </h3>
          <SectionBody lesson={lesson} section={section} rag={rag} />
        </section>
      ))}
    </div>
  )
}
