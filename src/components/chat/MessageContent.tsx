import { useMemo } from 'react'

interface MessageContentProps {
  content: string
}

// Simple markdown-like rendering
// For production, use react-markdown with proper sanitization
export function MessageContent({ content }: MessageContentProps) {
  const rendered = useMemo(() => {
    return parseContent(content)
  }, [content])

  return <div className="text-zinc-200 text-base leading-relaxed">{rendered}</div>
}

function parseContent(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let key = 0

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      nodes.push(
        ...parseInline(content.slice(lastIndex, match.index), key++)
      )
    }

    // Add code block
    const language = match[1] || ''
    const code = match[2].trim()
    nodes.push(
      <CodeBlock key={key++} code={code} language={language} />
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    nodes.push(...parseInline(content.slice(lastIndex), key++))
  }

  return nodes
}

function parseInline(text: string, baseKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let key = baseKey * 1000

  // Split by lines for paragraphs
  const lines = text.split('\n')

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      nodes.push(<br key={key++} />)
    }

    // Parse inline formatting
    const processed = line
    const parts: React.ReactNode[] = []
    let partKey = key * 1000

    // Process inline code first
    const inlineCodeRegex = /`([^`]+)`/g
    let lastIdx = 0
    let codeMatch

    while ((codeMatch = inlineCodeRegex.exec(processed)) !== null) {
      if (codeMatch.index > lastIdx) {
        parts.push(
          ...parseTextFormatting(processed.slice(lastIdx, codeMatch.index), partKey++)
        )
      }
      parts.push(
        <code
          key={partKey++}
          className="bg-zinc-800 px-1 py-0.5 rounded text-sm font-mono text-zinc-300"
        >
          {codeMatch[1]}
        </code>
      )
      lastIdx = codeMatch.index + codeMatch[0].length
    }

    if (lastIdx < processed.length) {
      parts.push(...parseTextFormatting(processed.slice(lastIdx), partKey++))
    }

    if (parts.length === 0 && line.length > 0) {
      parts.push(...parseTextFormatting(line, partKey++))
    }

    nodes.push(...parts)
  })

  return nodes
}

function parseTextFormatting(text: string, baseKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let key = baseKey * 100
  let remaining = text

  // Process bold (**text**)
  const boldRegex = /\*\*([^*]+)\*\*/
  const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/
  const underscoreItalicRegex = /_([^_]+)_/
  const strikeRegex = /~~([^~]+)~~/
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/
  const urlRegex = /(https?:\/\/[^\s<]+)/

  while (remaining.length > 0) {
    const boldMatch = boldRegex.exec(remaining)
    const italicMatch = italicRegex.exec(remaining)
    const underscoreMatch = underscoreItalicRegex.exec(remaining)
    const strikeMatch = strikeRegex.exec(remaining)
    const linkMatch = linkRegex.exec(remaining)
    const urlMatch = urlRegex.exec(remaining)

    // Find earliest match
    const matches = [
      boldMatch && { type: 'bold', match: boldMatch },
      italicMatch && { type: 'italic', match: italicMatch },
      underscoreMatch && { type: 'italic', match: underscoreMatch },
      strikeMatch && { type: 'strike', match: strikeMatch },
      linkMatch && { type: 'link', match: linkMatch },
      urlMatch && { type: 'url', match: urlMatch },
    ].filter(Boolean) as { type: string; match: RegExpExecArray }[]

    if (matches.length === 0) {
      nodes.push(remaining)
      break
    }

    matches.sort((a, b) => a.match.index - b.match.index)
    const earliest = matches[0]

    // Add text before match
    if (earliest.match.index > 0) {
      nodes.push(remaining.slice(0, earliest.match.index))
    }

    // Add formatted content
    switch (earliest.type) {
      case 'bold':
        nodes.push(<strong key={key++}>{earliest.match[1]}</strong>)
        break
      case 'italic':
        nodes.push(<em key={key++}>{earliest.match[1]}</em>)
        break
      case 'strike':
        nodes.push(
          <del key={key++} className="line-through">
            {earliest.match[1]}
          </del>
        )
        break
      case 'link':
        nodes.push(
          <a
            key={key++}
            href={earliest.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {earliest.match[1]}
          </a>
        )
        break
      case 'url':
        nodes.push(
          <a
            key={key++}
            href={earliest.match[1]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {earliest.match[1]}
          </a>
        )
        break
    }

    remaining = remaining.slice(earliest.match.index + earliest.match[0].length)
  }

  return nodes.length > 0 ? nodes : [text]
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
  }

  return (
    <div className="relative group my-2">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300"
        >
          Copy
        </button>
      </div>
      {language && (
        <div className="text-xs text-zinc-500 px-3 py-1 bg-zinc-800 rounded-t border-b border-zinc-700">
          {language}
        </div>
      )}
      <pre
        className={`bg-zinc-800 p-3 rounded${language ? '-b' : ''} overflow-x-auto`}
      >
        <code className="text-sm font-mono text-zinc-300">{code}</code>
      </pre>
    </div>
  )
}
