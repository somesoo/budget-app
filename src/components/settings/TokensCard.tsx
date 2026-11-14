import { useState, type FormEvent } from 'react'
import { Check, Copy, Key, Trash } from '@phosphor-icons/react'
import {
  ApiTokensUnavailableError,
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
} from '../../hooks/useApiTokens'
import { usePeople } from '../../hooks/usePeople'
import { t } from '../../i18n'
import { formatDayShort, toDateKey } from '../../lib/calculations'
import { SettingsCard } from './SettingsCard'

/**
 * Settings → Other apps: keys that let another app read the month and add an
 * expense (api/v1, docs/api.md). A key is shown once, when it's made.
 */
export function TokensCard() {
  const list = useApiTokens()
  const create = useCreateApiToken()
  const revoke = useRevokeApiToken()
  const { people } = usePeople()
  const [name, setName] = useState('')
  const [read, setRead] = useState(true)
  const [write, setWrite] = useState(false)
  const [person, setPerson] = useState('')
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // plain `npm run dev` has no server functions: nothing to set here
  if (list.error instanceof ApiTokensUnavailableError) return null

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id
  const scopes = [...(read ? (['read'] as const) : []), ...(write ? (['write'] as const) : [])]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !scopes.length) return
    create.mutate(
      { name: name.trim(), scopes, person: write && person ? person : null },
      {
        onSuccess: (made) => {
          setFresh(made.token)
          setCopied(false)
          setName('')
        },
      },
    )
  }

  const copy = async () => {
    if (!fresh) return
    try {
      await navigator.clipboard.writeText(fresh)
      setCopied(true)
    } catch {
      // no clipboard (an old browser, no permission): the key is on screen to select by hand
    }
  }

  const error = (create.error ?? revoke.error) as Error | null

  return (
    <SettingsCard title={t('settings.apps.title')} help={t('settings.apps.help')}>
      {list.isPending ? (
        <p className="text-sm text-muted">{t('settings.apps.checking')}</p>
      ) : list.error ? (
        <p className="text-sm text-red-300">{(list.error as Error).message}</p>
      ) : !list.data.canStore ? (
        <p className="text-xs leading-relaxed text-amber-200">{t('settings.apps.cantStore')}</p>
      ) : (
        <div className="space-y-3">
          {list.data.tokens.length === 0 ? (
            <p className="text-sm text-muted">{t('settings.apps.none')}</p>
          ) : (
            <ul className="space-y-2">
              {list.data.tokens.map((token) => (
                <li key={token.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                  <Key aria-hidden className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">{token.name}</p>
                    <p className="text-xs leading-snug text-muted">
                      {[
                        token.scopes.includes('read') ? t('settings.apps.scopeRead') : null,
                        token.scopes.includes('write') ? t('settings.apps.scopeWrite') : null,
                        token.person ? t('settings.apps.as', { name: nameOf(token.person) }) : null,
                        token.last_used_at
                          ? t('settings.apps.lastUsed', {
                              date: formatDayShort(toDateKey(new Date(token.last_used_at))),
                            })
                          : t('settings.apps.neverUsed'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(token.id)}
                    aria-label={t('settings.apps.revokeLabel', { name: token.name })}
                    className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-400/30 hover:bg-red-500/10 disabled:opacity-40"
                  >
                    <Trash aria-hidden /> {t('settings.apps.revoke')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fresh && (
            <div className="space-y-2 rounded-xl bg-amber-400/10 p-3 ring-1 ring-amber-300/30">
              <p className="text-xs leading-relaxed text-amber-100">{t('settings.apps.shownOnce')}</p>
              <code className="block select-all break-all rounded-lg bg-black/30 px-2 py-1.5 font-mono text-xs text-white">
                {fresh}
              </code>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="flex items-center gap-1.5 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-ink"
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? t('settings.apps.copied') : t('settings.apps.copy')}
                </button>
                <button
                  type="button"
                  onClick={() => setFresh(null)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
                >
                  {t('settings.apps.done')}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (create.error) create.reset()
              }}
              maxLength={40}
              autoComplete="off"
              placeholder={t('settings.apps.namePlaceholder')}
              aria-label={t('settings.apps.namePlaceholder')}
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-muted/60 focus:ring-white/40"
            />
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
                {t('settings.apps.read')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />
                {t('settings.apps.write')}
              </label>
            </div>
            {write && (
              <label className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                {t('settings.apps.person')}
                <select
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10"
                >
                  <option value="">{t('settings.apps.anyone')}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="submit"
              disabled={!name.trim() || !scopes.length || create.isPending}
              className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
            >
              {create.isPending ? t('settings.apps.creating') : t('settings.apps.create')}
            </button>
          </form>

          {error && <p className="text-sm text-red-300">{error.message}</p>}
          <p className="text-xs leading-relaxed text-muted">{t('settings.apps.docs')}</p>
        </div>
      )}
    </SettingsCard>
  )
}
