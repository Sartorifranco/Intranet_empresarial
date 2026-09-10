import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-heading">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neutral-100 dark:bg-zinc-800">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-neutral-200 px-2 py-1 text-left font-semibold text-heading dark:border-zinc-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-neutral-200 px-2 py-1 align-top dark:border-zinc-700">{children}</td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-brand-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
}

type RagAssistantMarkdownProps = {
  content: string
}

export function RagAssistantMarkdown({ content }: RagAssistantMarkdownProps) {
  return (
    <div className="rag-assistant-markdown break-words leading-relaxed [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
