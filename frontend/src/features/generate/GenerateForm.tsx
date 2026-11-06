import { useId, useState, type FormEvent } from 'react'
import { FlaskConical, LoaderCircle, Play } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useRunStream } from '@/features/workflow/runStreamContext'
import { DEFAULT_TOPIC, DEMO_REQUEST, isRagTopic } from '@/lib/constants'
import { useHealth } from '@/lib/queries'
import type { EnglishLevel, GenerateLessonRequest, TechnicalLevel } from '@/lib/types'

const NO_INJECTION = 'none'
const ENGLISH_LEVELS: EnglishLevel[] = ['basic', 'intermediate', 'advanced']
const TECHNICAL_LEVELS: TechnicalLevel[] = ['beginner', 'intermediate', 'advanced']

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function LevelSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: T[]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {capitalise(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function GenerateForm() {
  const health = useHealth()
  const { start, active, state } = useRunStream()
  const [topic, setTopic] = useState(DEFAULT_TOPIC)
  const [education, setEducation] = useState('12th-grade graduate')
  const [english, setEnglish] = useState<EnglishLevel>('basic')
  const [technical, setTechnical] = useState<TechnicalLevel>('beginner')
  const [retries, setRetries] = useState('2')
  const [reference, setReference] = useState('')
  const [demo, setDemo] = useState(false)
  const [injection, setInjection] = useState(NO_INJECTION)
  const [persistent, setPersistent] = useState(false)

  const demoAllowed = health.data?.demo_allowed ?? false
  const errorTypes = health.data?.error_types ?? []
  const ragTopic = isRagTopic(topic)
  const selected = errorTypes.find((item) => item.key === injection)
  const demoOn = demo && demoAllowed
  const hasInjection = demoOn && injection !== NO_INJECTION

  const setDemoMode = (on: boolean) => {
    setDemo(on)
    if (!on) {
      // The API refuses an injection outside demo mode, so these can't outlive the toggle.
      setInjection(NO_INJECTION)
      setPersistent(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const request: GenerateLessonRequest = {
      topic,
      learner_profile: { education, english_level: english, technical_level: technical },
      max_retries: Number(retries),
      reference_material: reference.trim() ? reference : null,
      demo_mode: demoOn,
      error_injection: hasInjection ? injection : null,
      persistent_error: hasInjection && persistent,
    }
    start(request)
  }

  const refused = state.phase === 'failed' && state.runId === null ? state.error : null

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="topic">Topic</Label>
        <Input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} required />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Learner</legend>
        <div className="space-y-1.5">
          <Label htmlFor="education">Education</Label>
          <Input
            id="education"
            value={education}
            maxLength={120}
            onChange={(event) => setEducation(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LevelSelect label="English proficiency" value={english} options={ENGLISH_LEVELS} onChange={setEnglish} />
          <LevelSelect label="Technical level" value={technical} options={TECHNICAL_LEVELS} onChange={setTechnical} />
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="retries">Retry limit</Label>
        <Select value={retries} onValueChange={setRetries}>
          <SelectTrigger id="retries" className="w-full" aria-describedby="retries-help">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 retries</SelectItem>
            <SelectItem value="1">1 retry</SelectItem>
            <SelectItem value="2">2 retries</SelectItem>
          </SelectContent>
        </Select>
        <p id="retries-help" className="text-sm text-muted-foreground">
          The lesson gets {Number(retries) + 1} attempt{retries === '0' ? '' : 's'} in total to pass the rubric.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reference">Reference material</Label>
        <Textarea
          id="reference"
          rows={4}
          value={reference}
          aria-describedby="reference-help"
          onChange={(event) => setReference(event.target.value)}
        />
        <p id="reference-help" className="text-sm text-muted-foreground">
          Optional. The source of truth for the lesson and its accuracy check.
          {ragTopic && ' If left empty, this RAG topic uses the built-in reference.'}
        </p>
      </div>

      {demoAllowed && (
        <div className={`overflow-hidden rounded-lg border ${demoOn ? 'border-caution' : ''}`}>
          {demoOn && <div className="demo-hazard h-2" aria-hidden />}
          <div className="space-y-4 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="demo-mode" className="font-semibold">
                  Demo mode
                </Label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Lets you damage the lesson on purpose, to prove that the evaluator catches it.
                </p>
              </div>
              <Switch id="demo-mode" checked={demoOn} onCheckedChange={setDemoMode} />
            </div>

            {demoOn && (
              <>
                <p className="flex items-center gap-2 rounded-sm bg-caution-soft px-2 py-1.5 text-sm font-semibold text-caution">
                  <FlaskConical className="size-4 shrink-0" aria-hidden />
                  DEMO / TEST MODE: this run is labelled as demo evidence
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="injection">Error injection type</Label>
                  <Select
                    value={injection}
                    onValueChange={(value) => {
                      setInjection(value)
                      if (value === NO_INJECTION) setPersistent(false)
                    }}
                  >
                    <SelectTrigger id="injection" className="w-full" aria-describedby="injection-help">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_INJECTION}>No injected error</SelectItem>
                      {errorTypes.map((item) => (
                        <SelectItem key={item.key} value={item.key} disabled={item.rag_only && !ragTopic}>
                          {item.label}
                          {item.rag_only && !ragTopic ? ' (RAG topics only)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p id="injection-help" className="text-sm text-muted-foreground">
                    {selected
                      ? `${selected.description} The evaluator should fail ${selected.expected_criteria.join(', ')}.`
                      : 'Choose a defect to add after generation. The generator never knows about it.'}
                  </p>
                  {selected?.rag_only && !ragTopic && (
                    <p className="text-sm font-medium text-fail">
                      This defect only applies to RAG topics, so the API will refuse this topic.
                    </p>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor="persistent">Persistent error</Label>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Re-injects the defect on every attempt, which forces a rejection.
                    </p>
                  </div>
                  <Switch
                    id="persistent"
                    checked={persistent}
                    disabled={!hasInjection}
                    onCheckedChange={setPersistent}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {refused && (
        <Alert variant="destructive" className="border-fail/50">
          <AlertTitle>The API refused this run</AlertTitle>
          <AlertDescription>{refused}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={active}>
          {active && <LoaderCircle className="animate-spin" aria-hidden />}
          Generate Lesson
        </Button>
        {demoAllowed && (
          <Button type="button" variant="outline" disabled={active} onClick={() => start(DEMO_REQUEST)}>
            <Play aria-hidden />
            Run assessment demo
          </Button>
        )}
      </div>
    </form>
  )
}
