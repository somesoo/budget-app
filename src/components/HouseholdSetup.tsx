import { Plus, X } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { usePeopleActions } from '../hooks/usePeople'
import { MAX_PEOPLE, PERSON_COLORS } from '../lib/people'
import type { Person } from '../types'
import { t } from '../i18n'
import { LanguagePicker } from './LanguagePicker'

/**
 * A fresh install's first screen: who's in the budget (one to four people,
 * any names), and which of them is holding this phone. Names can change
 * later in Settings; the phone can be switched there too.
 */
export function HouseholdSetup({ onDone }: { onDone: (me: Person) => void }) {
  const { setup } = usePeopleActions()
  const [names, setNames] = useState<string[]>([''])
  const [me, setMe] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const trimmed = names.map((n) => n.trim())
  const filled = trimmed.filter(Boolean)
  const duplicate = new Set(filled.map((n) => n.toLowerCase())).size !== filled.length
  const valid = filled.length > 0 && filled.length === names.length && !duplicate
  // "me" points at a row; with one person it's them
  const meIndex = Math.min(me, names.length - 1)

  const change = (i: number, value: string) =>
    setNames((list) => list.map((n, j) => (j === i ? value : n)))
  const add = () => setNames((list) => (list.length < MAX_PEOPLE ? [...list, ''] : list))
  const remove = (i: number) => {
    setNames((list) => list.filter((_, j) => j !== i))
    setMe((m) => (m === i ? 0 : m > i ? m - 1 : m))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setError(null)
    try {
      const people = await setup.mutateAsync(trimmed)
      onDone(people[meIndex].id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10">
      <form onSubmit={submit} className="grid gap-6">
        <div>
          <div className="mb-4 flex justify-end">
            <LanguagePicker />
          </div>
          <h1 className="text-3xl font-bold text-white">{t('setup.title')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t('setup.intro')}
          </p>
        </div>

        <ul className="grid gap-2">
          {names.map((name, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: PERSON_COLORS[i] }}
              />
              <input
                value={name}
                onChange={(e) => change(i, e.target.value)}
                maxLength={30}
                autoFocus={i === names.length - 1}
                autoComplete="off"
                placeholder={i === 0 ? t('setup.yourName') : t('setup.person', { n: i + 1 })}
                aria-label={t('setup.person', { n: i + 1 })}
                className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-3 text-lg text-white outline-none ring-1 ring-white/10 placeholder:text-muted/60 focus:ring-white/40"
              />
              {names.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={t('settings.people.remove', {
                    name: name.trim() || t('setup.person', { n: i + 1 }),
                  })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-muted hover:bg-white/5 hover:text-white"
                >
                  <X />
                </button>
              )}
            </li>
          ))}
        </ul>

        {names.length < MAX_PEOPLE && (
          <button
            type="button"
            onClick={add}
            className="-mt-3 flex items-center gap-1.5 self-start rounded-full px-3 py-2 text-sm font-semibold text-accent-soft hover:bg-accent/10"
          >
            <Plus weight="bold" aria-hidden /> {t('settings.people.addPlaceholder')}
          </button>
        )}

        {names.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm text-muted">{t('setup.whichPhone')}</legend>
            <div className="flex flex-wrap gap-2">
              {names.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMe(i)}
                  aria-pressed={meIndex === i}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
                    meIndex === i
                      ? 'bg-slate-50 text-ink ring-white'
                      : 'text-slate-300 ring-white/15 hover:bg-white/5'
                  }`}
                >
                  {name.trim() || t('setup.person', { n: i + 1 })}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {duplicate && (
          <p className="text-sm text-amber-200">{t('setup.duplicate')}</p>
        )}
        {error && <p className="text-sm text-red-300">{t('entry.notSaved', { error })}</p>}

        <button
          type="submit"
          disabled={!valid || setup.isPending}
          className="h-14 rounded-2xl bg-slate-50 text-lg font-bold text-ink transition active:scale-[0.99] disabled:opacity-40"
        >
          {setup.isPending ? t('setup.settingUp') : t('setup.start')}
        </button>
      </form>
    </div>
  )
}
