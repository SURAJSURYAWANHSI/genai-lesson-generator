import ReactMarkdown, { type Components } from 'react-markdown'

const components: Components = {
  // Lesson headings sit inside numbered sections, so they must not outrank them.
  h1: 'h3',
  h2: 'h4',
  h3: 'h5',
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
}

/**
 * Renders generated text as Markdown. Raw HTML stays escaped because rehype-raw isn't used, and
 * images are dropped so that a generated lesson can never make the browser load a remote file.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown components={components} disallowedElements={['img']} unwrapDisallowed>
        {children}
      </ReactMarkdown>
    </div>
  )
}
