import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      title="This page doesn't exist"
      action={
        <Button asChild>
          <Link to="/">Go to the dashboard</Link>
        </Button>
      }
    >
      The address may be mistyped.
    </EmptyState>
  )
}
