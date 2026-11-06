import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { ErrorBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { invalidateRunData } from '@/lib/queries'
import { CRITERIA } from '@/lib/rubric'
import type { FeedbackRating } from '@/lib/types'

const RATINGS: { value: FeedbackRating; label: string }[] = [
  { value: 'approve', label: 'Approve' },
  { value: 'needs_changes', label: 'Needs changes' },
  { value: 'reject', label: 'Reject' },
]
const ANY_CRITERION = 'any'

export function FeedbackTab({ runId }: { runId: string }) {
  const [rating, setRating] = useState<FeedbackRating>('needs_changes')
  const [comment, setComment] = useState('')
  const [criterion, setCriterion] = useState(ANY_CRITERION)
  const [reviewer, setReviewer] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.addFeedback(runId, {
        rating,
        comment,
        criterion_id: criterion === ANY_CRITERION ? null : criterion,
        ...(reviewer.trim() ? { reviewer: reviewer.trim() } : {}),
      }),
    onSuccess: () => {
      setComment('')
      invalidateRunData()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Requested changes become guidance for later generations on this topic. Approvals are stored but don't become
        guidance. Feedback never changes this run's result.
      </p>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Rating</legend>
        <div className="flex flex-wrap gap-4">
          {RATINGS.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rating"
                value={item.value}
                checked={rating === item.value}
                onChange={() => setRating(item.value)}
                className="size-4 accent-primary"
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="feedback-comment">Comment</Label>
        <Textarea
          id="feedback-comment"
          required
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="feedback-criterion">Criterion</Label>
          <Select value={criterion} onValueChange={setCriterion}>
            <SelectTrigger id="feedback-criterion" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_CRITERION}>Not about one criterion</SelectItem>
              {CRITERIA.map(({ id, name }) => (
                <SelectItem key={id} value={id}>
                  {id} {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feedback-reviewer">Your name</Label>
          <Input
            id="feedback-reviewer"
            maxLength={120}
            placeholder="anonymous"
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
          />
        </div>
      </div>
      {mutation.isError && <ErrorBlock error={mutation.error} title="Feedback was not recorded" />}
      {mutation.isSuccess && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-pass">
          <CircleCheck className="size-4" aria-hidden />
          Feedback recorded from {mutation.data.reviewer}.
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        Record feedback
      </Button>
    </form>
  )
}
