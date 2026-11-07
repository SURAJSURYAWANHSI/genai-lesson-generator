import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <PageHeader
      title="This page doesn't exist"
      actions={
        <Button asChild size="lg">
          <Link to="/">Go to the dashboard</Link>
        </Button>
      }
    >
      The address may be mistyped.
    </PageHeader>
  )
}
