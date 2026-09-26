import { ChatCircleDots, List, PaperPlaneRight, Plus, Sparkle, Trash } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BottomSheet } from '../components/history/BottomSheet'
import { SettingsLink } from '../components/SettingsLink'
import { PERSON_LABELS } from '../config'
import {
  ChatUnavailableError,
  useAsk,
  useChatContext,
  useDeleteThread,
  useMessages,
  useThreads,
} from '../hooks/useChat'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { plainDashes } from '../lib/calculations'
import type { ChatThread } from '../types'

const STARTERS = [
  'Are we on track with our savings goals?',
  'Where can we cut back for the rest of this month?',
  'How much should we put aside next month?',
  'What did we spend the most on lately, and was it worth it?',
]

/**
 * The Ask tab: a conversation about the household's money. Threads are
 * shared by both phones; every question goes out with a fresh snapshot of
 * the data, so answers are about today's numbers.
 */
export function Ask() {
  const [params, setParams] = useSearchParams()
  const threadId = params.get('t')
  const { data: threadData, isLoading } = useThreads()
  const { data: messages = [] } = useMessages(threadId)
  const context = useChatContext()
  const ask = useAsk()
  const remove = useDeleteThread()
  const { person } = useDeviceUser()
  const [draft, setDraft] = useState(params.get('q') ?? '')
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [threadsOpen, setThreadsOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const threads = threadData?.threads ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pendingQuestion])

  const openThread = (id: string | null) => {
    setThreadsOpen(false)
    setParams(id ? { t: id } : {}, { replace: false })
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const send = (question: string) => {
    const q = question.trim()
    if (!q || ask.isPending || !context.ready) return
    setPendingQuestion(q)
    setDraft('')
    ask.mutate(
      { threadId, question: q, person: person ?? 'bubs', context: context.build() },
      {
        onSuccess: (id) => {
          if (id !== threadId) setParams({ t: id }, { replace: true })
        },
        onSettled: () => setPendingQuestion(null),
        onError: () => setDraft(q),
      },
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }

  if (!isLoading && threadData && !threadData.available) {
    return (
      <Shell onThreads={() => undefined} hasThreads={false}>
        <section className="m-auto max-w-lg rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
          <ChatCircleDots aria-hidden className="text-3xl text-accent-soft" />
          <h2 className="mt-3 text-lg font-semibold text-white">One step in Supabase first</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            Conversations are saved in the tables from{' '}
            <code className="rounded bg-white/10 px-1">supabase/migrations/0008_ai_chat.sql</code>.
            Paste it into the SQL Editor and run it, as with the earlier ones.
          </p>
        </section>
      </Shell>
    )
  }

  const last = messages[messages.length - 1]
  // the question shows at once; once saved it's in `messages` and this steps aside
  const pendingShown =
    pendingQuestion !== null && !(last?.role === 'user' && last.content === pendingQuestion)
  const shown = [
    ...messages,
    ...(pendingShown
      ? [
          {
            id: 'pending',
            role: 'user' as const,
            content: pendingQuestion!,
            person: person ?? null,
          },
        ]
      : []),
  ]
  const followUps =
    !ask.isPending && last?.role === 'assistant' ? splitAnswer(last.content).followUps : []

  return (
    <Shell
      onThreads={() => setThreadsOpen(true)}
      hasThreads={threads.length > 0}
      sidebar={
        <ThreadList
          threads={threads}
          current={threadId}
          onOpen={openThread}
          onDelete={(id) => {
            remove.mutate(id)
            if (id === threadId) openThread(null)
          }}
        />
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 lg:px-0">

        {shown.length === 0 ? (
          <div className="flex min-h-full flex-col justify-end pb-4 lg:justify-center">
            <Sparkle weight="fill" aria-hidden className="text-2xl text-accent-soft" />
            <h2 className="mt-2 text-xl font-semibold text-white">Ask about your money</h2>
            <p className="mt-1 max-w-md text-sm text-slate-300">
              It sees your budget, plans, recent expenses, savings and goals, and answers with your
              numbers. Ask in Polish or English.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={!context.ready || ask.isPending}
                  className="rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4 pb-4">
            {shown.map((m) =>
              m.role === 'user' ? (
                <li key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-[15px] text-white">
                    {m.content}
                    {m.person && (
                      <span className="mt-0.5 block text-right text-xs text-muted">
                        {PERSON_LABELS[m.person]}
                      </span>
                    )}
                  </div>
                </li>
              ) : (
                <li key={m.id} className="flex gap-3">
                  <Sparkle weight="fill" aria-hidden className="mt-1 shrink-0 text-accent-soft" />
                  <AnswerText text={splitAnswer(m.content).body} />
                </li>
              ),
            )}
            {ask.isPending && (
              <li className="flex gap-3" aria-live="polite">
                <Sparkle weight="fill" aria-hidden className="mt-1 shrink-0 text-accent-soft" />
                <span className="text-sm text-muted motion-safe:animate-pulse">
                  Looking at your numbers…
                </span>
              </li>
            )}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 px-4 pt-2 lg:px-0">
        {ask.error && (
          <p role="alert" className="mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {ask.error instanceof ChatUnavailableError
              ? ask.error.message
              : `Couldn’t get an answer: ${(ask.error as Error).message}`}
          </p>
        )}
        {followUps.length > 0 && (
          <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => send(f)}
                className="shrink-0 rounded-full bg-accent/10 px-3 py-1.5 text-sm text-accent-soft ring-1 ring-accent/25 hover:bg-accent/20"
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(draft)
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={threadId ? 'Ask a follow-up' : 'Ask anything about your money'}
            aria-label="Your question"
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl bg-white/5 px-4 py-3 text-base text-white outline-none ring-1 ring-white/10 [field-sizing:content] placeholder:text-muted focus:ring-white/40"
          />
          <button
            type="submit"
            disabled={!draft.trim() || ask.isPending || !context.ready}
            aria-label="Send"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl text-ink hover:bg-slate-50 disabled:opacity-40"
          >
            <PaperPlaneRight weight="fill" aria-hidden />
          </button>
        </form>
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Sent to Gemini with each question: this month and the plans, a year of monthly totals, the
          last 3 months of expenses with their notes, income, savings accounts and goals.
        </p>
      </div>

      {threadsOpen && (
        <BottomSheet title="Conversations" onClose={() => setThreadsOpen(false)}>
          <ThreadList
            threads={threads}
            current={threadId}
            onOpen={openThread}
            onDelete={(id) => {
              remove.mutate(id)
              if (id === threadId) openThread(null)
            }}
          />
        </BottomSheet>
      )}
    </Shell>
  )
}

function Shell({
  sidebar,
  onThreads,
  hasThreads,
  children,
}: {
  sidebar?: ReactNode
  onThreads: () => void
  hasThreads: boolean
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] lg:max-w-6xl lg:flex-row lg:gap-8 lg:px-8 lg:pb-6 lg:pt-8">
      {sidebar && <aside className="hidden w-64 shrink-0 flex-col lg:flex">{sidebar}</aside>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="mb-4 flex shrink-0 items-center justify-between gap-3 px-4 lg:mb-6 lg:px-0">
          <h1 className="text-2xl font-bold text-white lg:text-3xl lg:tracking-tight">Ask</h1>
          <div className="flex items-center gap-1 lg:hidden">
            {hasThreads && (
              <button
                type="button"
                onClick={onThreads}
                aria-label="Conversations"
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-muted hover:bg-white/5"
              >
                <List aria-hidden />
              </button>
            )}
            <SettingsLink />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

function ThreadList({
  threads,
  current,
  onOpen,
  onDelete,
}: {
  threads: ChatThread[]
  current: string | null
  onOpen: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2 pb-2">
      <button
        type="button"
        onClick={() => onOpen(null)}
        className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold text-ink hover:bg-slate-50"
      >
        <Plus weight="bold" aria-hidden /> New conversation
      </button>
      <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {threads.map((t) => (
          <li key={t.id} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(t.id)}
              className={`w-full truncate rounded-xl py-2.5 pl-3 pr-9 text-left text-sm transition ${
                t.id === current ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.title}
            </button>
            <button
              type="button"
              onClick={() => onDelete(t.id)}
              aria-label={`Delete conversation: ${t.title}`}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted opacity-0 hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100"
            >
              <Trash aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The answer body and its "Next questions:" list, which becomes buttons. */
export function splitAnswer(text: string): { body: string; followUps: string[] } {
  const clean = plainDashes(text)
  const match = clean.match(
    /\n\s*(?:\*\*)?(?:Next questions|Kolejne pytania|Następne pytania)\s*:?(?:\*\*)?\s*\n([\s\S]*)$/i,
  )
  if (!match) return { body: clean.trim(), followUps: [] }
  const followUps = match[1]
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
  return { body: clean.slice(0, match.index).trim(), followUps }
}

/** Paragraphs, "- " lists and **bold**: all the formatting the prompt asks for, rendered as React text. */
function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="min-w-0 space-y-2.5 text-[15px] leading-relaxed text-slate-100">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim())
        if (lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^\s*[-*•]\s+/, '• '))}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}
