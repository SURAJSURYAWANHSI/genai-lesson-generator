import { useId, useState, type FormEvent, type ReactNode } from 'react'
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

interface Option {
  value: string
  label: string
  disabled?: boolean
}

function SelectField({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  help?: ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full" aria-describedby={help ? `${id}-help` : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {help && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
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

  const demoAllowed = health.data?.demo_allowed ?? false
  const ragTopic = isRagTopic(topic)
  const demoOn = demo && demoAllowed

  const setDemoMode = (on: boolean) => {
    setDemo(on)
    // The API refuses an injection outside demo mode, so it can't outlive the toggle.
    if (!on) setInjection(NO_INJECTION)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const request: GenerateLessonRequest = {
      topic,
      learner_profile: { education, english_level: english, technical_level: technical },
      max_retries: Number(retries),
      reference_material: reference.trim() ? reference : null,
      demo_mode: demoOn,
      error_injection: demoOn && injection !== NO_INJECTION ? injection : null,
    }
    start(request)
  }

  const refused = state.phase === 'failed' && state.runId === null ? state.error : null

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="topic">Topic</Label>
        <Input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="education">Learner education</Label>
        <Input id="education" value={education} maxLength={120} onChange={(event) => setEducation(event.target.value)} />
      </div>
      <SelectField
        label="English proficiency"
        value={english}
        onChange={(value) => setEnglish(value as EnglishLevel)}
        options={[
          { value: 'basic', label: 'Basic' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ]}
      />
      <SelectField
        label="Technical level"
        value={technical}
        onChange={(value) => setTechnical(value as TechnicalLevel)}
        options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ]}
      />
      <SelectField
        label="Retry limit"
        value={retries}
        onChange={setRetries}
        help="How many times the lesson can be rewritten if it fails a check."
        options={[
          { value: '0', label: 'No retries' },
          { value: '1', label: '1 retry' },
          { value: '2', label: '2 retries' },
        ]}
      />
      <div className="space-y-1.5">
        <Label htmlFor="reference">
          Reference material <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="reference"
          rows={3}
          value={reference}
          aria-describedby="reference-help"
          onChange={(event) => setReference(event.target.value)}
        />
        <p id="reference-help" className="text-sm text-muted-foreground">
          Text the lesson should be based on.
        </p>
      </div>

      {demoAllowed && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="demo-mode">Demo mode</Label>
              <p className="mt-1 text-sm text-muted-foreground">Plants a mistake to show the checks catching it.</p>
            </div>
            <Switch id="demo-mode" checked={demoOn} onCheckedChange={setDemoMode} />
          </div>
          {demoOn && (
            <div className="space-y-4 rounded-lg bg-caution-soft p-4">
              <p className="text-sm font-semibold text-caution">DEMO / TEST MODE</p>
              <SelectField
                label="Error injection type"
                value={injection}
                onChange={setInjection}
                options={[
                  { value: NO_INJECTION, label: 'No planted mistake' },
                  ...(health.data?.error_types ?? []).map((item) => {
                    const blocked = item.rag_only && !ragTopic
                    return {
                      value: item.key,
                      label: blocked ? `${item.label} (RAG topics only)` : item.label,
                      disabled: blocked,
                    }
                  }),
                ]}
              />
            </div>
          )}
        </div>
      )}

      {refused && (
        <div role="alert" className="rounded-lg bg-fail-soft px-5 py-4">
          <p className="font-medium">This lesson couldn't be started</p>
          <p className="mt-1 text-muted-foreground">{refused}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" size="lg" disabled={active}>
          Generate Lesson
        </Button>
        {demoAllowed && (
          <Button type="button" variant="ghost" disabled={active} onClick={() => start(DEMO_REQUEST)}>
            Run the demo instead
          </Button>
        )}
      </div>
    </form>
  )
}
