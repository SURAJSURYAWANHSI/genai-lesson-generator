import { Disclosure } from '@/components/Disclosure'
import { SectionHeading } from '@/components/PageHeader'
import { ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { plainText } from '@/lib/format'
import { usePrompts } from '@/lib/queries'
import type { PromptVersion } from '@/lib/types'

const PROMPT_NAMES: Record<string, string> = { generator: 'Lesson writer', evaluator: 'Lesson checker' }

function promptTitle(prompt: PromptVersion): string {
  return `${PROMPT_NAMES[prompt.name] ?? prompt.name}, version ${prompt.version}`
}

export function PromptVersions() {
  const prompts = usePrompts()
  return (
    <section aria-labelledby="prompts-heading" className="space-y-2">
      <SectionHeading id="prompts-heading">Prompt versions</SectionHeading>
      {prompts.isPending && <LoadingBlock rows={2} label="Loading prompt versions" />}
      {prompts.isError && (
        <ErrorBlock error={prompts.error} title="Prompt versions couldn't be loaded" onRetry={() => void prompts.refetch()} />
      )}
      {prompts.data?.length === 0 && <p className="text-muted-foreground">None yet.</p>}
      <div className="divide-y">
        {prompts.data?.map((prompt) => (
          <Disclosure
            key={prompt.id}
            summary={
              <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-medium">
                  {promptTitle(prompt)}
                  {prompt.is_active && <span className="font-normal text-muted-foreground"> (in use)</span>}
                </span>
                <span className="text-sm text-muted-foreground">{plainText(prompt.change_summary)}</span>
              </span>
            }
          >
            <p className="max-h-96 max-w-[72ch] overflow-y-auto text-sm whitespace-pre-wrap text-muted-foreground">
              {prompt.content}
            </p>
          </Disclosure>
        ))}
      </div>
    </section>
  )
}
