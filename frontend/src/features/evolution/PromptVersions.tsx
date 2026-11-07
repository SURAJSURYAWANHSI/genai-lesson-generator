import { Disclosure } from '@/components/Disclosure'
import { Panel } from '@/components/PageHeader'
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
    <Panel id="prompts-heading" title="Prompt versions">
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
                <span className="font-semibold">
                  {promptTitle(prompt)}
                  {prompt.is_active && <span className="ml-2 rounded-full bg-pass-soft px-2 py-0.5 text-xs font-bold text-pass">In use</span>}
                </span>
                <span className="text-sm text-muted-foreground">{plainText(prompt.change_summary)}</span>
              </span>
            }
          >
            <p className="max-w-[72ch] text-sm whitespace-pre-wrap text-muted-foreground">
              {prompt.content}
            </p>
          </Disclosure>
        ))}
      </div>
    </Panel>
  )
}
