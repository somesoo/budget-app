import { Fragment, type ReactNode } from 'react'
import { template, type MessageKey } from '.'

type Values = Record<string, ReactNode>
type Tags = Record<string, (children: ReactNode) => ReactNode>

function fill(text: string, values: Values, keyPrefix: string): ReactNode[] {
  return text.split(/(\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]
    const node = name !== undefined && name in values ? values[name] : part
    return <Fragment key={`${keyPrefix}${i}`}>{node}</Fragment>
  })
}

/**
 * A translated text with markup in it. `{name}` placeholders take any node
 * (an icon, a bold amount), and `<tag>…</tag>` wraps a stretch of the text in
 * what `tags[tag]` returns, so a translation can move the bold word around:
 *
 *   "Your priciest day is <b>{day}</b>"  with  tags={{ b: (s) => <strong>{s}</strong> }}
 */
export function Trans({
  k,
  values = {},
  tags = {},
  count,
}: {
  k: MessageKey
  values?: Values
  tags?: Tags
  count?: number
}) {
  const text = template(k, count)
  const all: Values = count === undefined ? values : { count, ...values }
  const out: ReactNode[] = []
  const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(text))) {
    out.push(...fill(text.slice(last, match.index), all, `t${out.length}-`))
    const wrap = tags[match[1]]
    const inner = fill(match[2], all, `i${out.length}-`)
    out.push(<Fragment key={`w${out.length}`}>{wrap ? wrap(inner) : inner}</Fragment>)
    last = match.index + match[0].length
  }
  out.push(...fill(text.slice(last), all, `e${out.length}-`))
  return <>{out}</>
}
