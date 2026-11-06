/** Ten cells with Q07 failed: the rubric strip reduced to a logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 39 12" className={className} aria-hidden>
      {Array.from({ length: 10 }, (_, index) => (
        <rect
          key={index}
          x={index * 4}
          y={index === 6 ? 0 : 3}
          width="3"
          height={index === 6 ? 12 : 6}
          rx="0.5"
          fill={index === 6 ? 'var(--fail)' : 'var(--primary)'}
        />
      ))}
    </svg>
  )
}
