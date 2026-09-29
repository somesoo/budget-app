import {
  CaretRight,
  ChartDonut,
  Compass,
  DownloadSimple,
  Plus,
  Sparkle,
  SignOut,
  Trash,
  WifiHigh,
  WifiSlash,
} from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ADD_WIDGETS } from '../components/add/widgets'
import { MoneyInput } from '../components/budget/MoneyInput'
import { Screen } from '../components/Screen'
import { Segments, Switch } from '../components/savings/fields'
import { CategorySheet } from '../components/settings/CategorySheet'
import { CardAction, SettingsCard } from '../components/settings/SettingsCard'
import { UserSwitcher } from '../components/UserSwitcher'
import { resetDismissedAlerts, useDismissedCount } from '../hooks/useBudgetAlerts'
import { useCategories } from '../hooks/useCategories'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { usePeople, usePeopleActions } from '../hooks/usePeople'
import { useMonthlyExpensesBetween } from '../hooks/useExpenses'
import { GeminiKeyUnavailableError, useGeminiKey, useSaveGeminiKey } from '../hooks/useGeminiKey'
import { useGoal, useUpsertGoal } from '../hooks/useGoal'
import { DEFAULT_PREFS, setPrefs, usePrefs } from '../hooks/usePrefs'
import { useRealtimeStatus } from '../hooks/useRealtimeSync'
import { useSavingsOverview } from '../hooks/useSavings'
import { useSession } from '../hooks/useSession'
import {
  currentMonthKey,
  formatAmount,
  formatMoney,
  roundMoney,
  shiftMonth,
  sumByCategory,
} from '../lib/calculations'
import { downloadCsv } from '../lib/exportCsv'
import { monthsEndingAt, windowRange } from '../lib/insights'
import { supabase } from '../lib/supabaseClient'
import { tourStore } from '../lib/tour'
import { MAX_PEOPLE, personIds } from '../lib/people'
import type { Category } from '../types'
import { formatList, LANGUAGES, setLanguage, t, useLanguage, type Language } from '../i18n'
import { Trans } from '../i18n/Trans'

/** Months averaged for the "typical" figure next to each limit. */
const TYPICAL_MONTHS = 3

type CategoryEdit = { category?: Category } | null

/**
 * Settings in compact cards. Shared settings (categories) change both
 * phones; the ones marked "this device" stay on this one.
 */
export function Settings() {
  const { data: categories = [] } = useCategories()
  const savings = useSavingsOverview()
  const [editing, setEditing] = useState<CategoryEdit>(null)

  // what each category has actually cost lately, next to its limit
  const months = monthsEndingAt(shiftMonth(currentMonthKey(), -1), TYPICAL_MONTHS)
  const { from, to } = windowRange(months)
  const { data: recent } = useMonthlyExpensesBetween(from, to)
  const typicalOf = (id: string) =>
    recent ? roundMoney((sumByCategory(recent)[id] ?? 0) / TYPICAL_MONTHS) : undefined

  const monthly = categories.filter((c) => c.kind !== 'project')
  const active = monthly.filter((c) => !c.archived)

  return (
    <Screen title={t('settings.title')} wide>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-4">
          <PeopleCard />
          <DeviceCard />
          <LanguageCard />
          <CategoriesCard
            categories={monthly}
            typicalOf={typicalOf}
            onEdit={(category) => setEditing({ category })}
            onNew={() => setEditing({})}
          />
        </div>
        <div className="space-y-4">
          <AddScreenCard />
          <WidgetsCard />
          <WarningsCard />
          <SavingsSettings
            available={savings.available}
            accounts={savings.accounts.length}
            goals={savings.goals.length}
          />
          <AiCard />
          <HelpCard />
          <DataCard categories={categories} />
          <AccountCard />
        </div>
      </div>

      {editing && (
        <CategorySheet
          category={editing.category}
          typical={editing.category ? typicalOf(editing.category.id) : undefined}
          neighbours={
            editing.category
              ? {
                  up: active[active.findIndex((c) => c.id === editing.category!.id) - 1],
                  down: active[active.findIndex((c) => c.id === editing.category!.id) + 1],
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  )
}

/* ---------- who's in the budget ---------- */

function PeopleCard() {
  const { people, available } = usePeople()
  const { add, rename, remove } = usePeopleActions()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const taken = (name: string, except?: string) =>
    people.some((p) => p.id !== except && p.name.toLowerCase() === name.trim().toLowerCase())

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!available) {
    return (
      <SettingsCard
        title={t('settings.people.title')}
        help={t('settings.people.helpShort')}
        tour="settings-people"
      >
        <p className="text-sm leading-relaxed text-slate-300">
          <Trans
            k="settings.people.migration"
            values={{
              file: 'supabase/archive/0015_people.sql',
              names: formatList(people.map((p) => p.name)),
            }}
            tags={{ code: (s) => <code className="rounded bg-white/10 px-1">{s}</code> }}
          />
        </p>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard
      title={t('settings.people.title')}
      help={t('settings.people.help')}
      tour="settings-people"
    >
      <ul className="grid gap-2">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <input
              defaultValue={p.name}
              key={p.name}
              maxLength={30}
              aria-label={t('settings.people.nameOf', { name: p.name })}
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (!name || name === p.name) {
                  e.target.value = p.name
                  return
                }
                if (taken(name, p.id)) {
                  e.target.value = p.name
                  setError(t('settings.people.taken', { name }))
                  return
                }
                void run(() => rename.mutateAsync({ id: p.id, name }))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-white/40"
            />
            {people.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('settings.people.confirmRemove', { name: p.name })))
                    void run(() => remove.mutateAsync(p.id))
                }}
                aria-label={t('settings.people.remove', { name: p.name })}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-red-300"
              >
                <Trash aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      {people.length < MAX_PEOPLE && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const name = newName.trim()
            if (!name) return
            if (taken(name)) return setError(t('settings.people.taken', { name }))
            void run(async () => {
              await add.mutateAsync({ name, people })
              setNewName('')
            })
          }}
        >
          <span aria-hidden className="h-3 w-3 shrink-0" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={30}
            placeholder={t('settings.people.addPlaceholder')}
            aria-label={t('settings.people.newName')}
            className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 placeholder:text-muted/60 focus:ring-white/40"
          />
          <button
            type="submit"
            disabled={!newName.trim() || add.isPending}
            aria-label={t('common.add')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-accent-soft ring-1 ring-accent/30 hover:bg-accent/10 disabled:opacity-40"
          >
            <Plus weight="bold" aria-hidden />
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </SettingsCard>
  )
}

/* ---------- this device ---------- */

function DeviceCard() {
  const { person, setPerson } = useDeviceUser()
  const status = useRealtimeStatus()
  const live = status === 'live'
  return (
    <SettingsCard
      title={t('settings.device.title')}
      help={
        personIds().length > 1 ? t('settings.device.helpPeople') : t('settings.device.helpAlone')
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {person && <UserSwitcher value={person} onChange={setPerson} />}
        <span
          className={`flex items-center gap-1.5 text-sm ${live ? 'text-positive' : 'text-amber-300'}`}
        >
          {live ? <WifiHigh aria-hidden /> : <WifiSlash aria-hidden />}
          {live
            ? t('settings.device.live')
            : status === 'connecting'
              ? t('settings.device.connecting')
              : t('settings.device.offline')}
        </span>
      </div>
    </SettingsCard>
  )
}

/* ---------- language ---------- */

function LanguageCard() {
  const language = useLanguage()
  return (
    <SettingsCard title={t('settings.language.title')} help={t('settings.language.help')}>
      <Segments
        value={language}
        onChange={(v) => setLanguage(v as Language)}
        options={(Object.keys(LANGUAGES) as Language[]).map((id) => ({
          value: id,
          label: LANGUAGES[id].name,
        }))}
      />
    </SettingsCard>
  )
}

/* ---------- categories ---------- */

function CategoriesCard({
  categories,
  typicalOf,
  onEdit,
  onNew,
}: {
  categories: Category[]
  typicalOf: (id: string) => number | undefined
  onEdit: (c: Category) => void
  onNew: () => void
}) {
  const [showHidden, setShowHidden] = useState(false)
  const active = categories.filter((c) => !c.archived)
  const hidden = categories.filter((c) => c.archived)
  const totalLimit = active.reduce((a, c) => a + c.monthly_limit, 0)
  const totalTypical = active.reduce((a, c) => a + (typicalOf(c.id) ?? 0), 0)
  const hasTypical = active.some((c) => typicalOf(c.id) !== undefined)

  const row = (c: Category) => {
    const typical = typicalOf(c.id)
    const over = typical !== undefined && c.monthly_limit > 0 && typical > c.monthly_limit
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => onEdit(c)}
          className={`group grid w-full grid-cols-[auto_minmax(0,1fr)_4.5rem_5rem_auto] items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/5 ${
            c.archived ? 'opacity-50' : ''
          }`}
        >
          <span aria-hidden className="h-3 w-3 rounded" style={{ backgroundColor: c.color }} />
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] text-white">{c.name}</span>
            {!c.show_in_chart && (
              <ChartDonut
                aria-label={t('settings.categories.leftOut')}
                className="shrink-0 text-sm text-muted"
              />
            )}
          </span>
          <span
            className={`text-right text-sm tabular-nums ${over ? 'text-amber-200' : 'text-muted'}`}
            title={over ? t('settings.categories.usuallyOver') : undefined}
          >
            {typical === undefined ? '' : formatAmount(Math.round(typical))}
          </span>
          <span className="text-right text-[15px] font-semibold tabular-nums text-white">
            {formatAmount(c.monthly_limit)}
          </span>
          <CaretRight aria-hidden className="text-muted transition group-hover:translate-x-0.5" />
        </button>
      </li>
    )
  }

  return (
    <SettingsCard
      title={t('settings.categories.title')}
      help={t('settings.categories.help')}
      tour="settings-categories"
      action={
        <CardAction onClick={onNew}>
          <Plus weight="bold" aria-hidden /> {t('settings.categories.new')}
        </CardAction>
      }
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_4.5rem_5rem_auto] gap-3 px-2 pb-1 text-xs text-muted">
        <span className="w-3" />
        <span>{t('settings.categories.name')}</span>
        <span className="text-right">{hasTypical ? t('settings.categories.usually') : ''}</span>
        <span className="text-right">{t('settings.categories.limit')}</span>
        <span className="w-4" />
      </div>
      <ul className="divide-y divide-white/5">{active.map(row)}</ul>
      <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_4.5rem_5rem_auto] gap-3 border-t border-white/10 px-2 pt-2.5 text-sm">
        <span className="w-3" />
        <span className="text-muted">{t('settings.categories.total')}</span>
        <span className="text-right tabular-nums text-muted">
          {hasTypical ? formatAmount(Math.round(totalTypical)) : ''}
        </span>
        <span className="text-right font-semibold tabular-nums text-white">
          {formatAmount(totalLimit)}
        </span>
        <span className="w-4" />
      </div>
      <p className="mt-3 text-xs leading-snug text-muted">
        <Trans
          k="settings.categories.legend"
          count={TYPICAL_MONTHS}
          values={{ icon: <ChartDonut aria-hidden className="inline align-[-0.15em]" /> }}
        />
      </p>
      {hidden.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            aria-expanded={showHidden}
            className="mt-3 text-sm font-medium text-muted hover:text-white"
          >
            {showHidden
              ? t('settings.categories.hideHidden', { count: hidden.length })
              : t('settings.categories.showHidden', { count: hidden.length })}
          </button>
          {showHidden && <ul className="mt-1 divide-y divide-white/5">{hidden.map(row)}</ul>}
        </>
      )}
    </SettingsCard>
  )
}

/* ---------- this device: Add screen and warnings ---------- */

function AddScreenCard() {
  const prefs = usePrefs()
  const set = (i: number, v: number) => {
    const next = [...prefs.quickAmounts]
    next[i] = v
    if (next.every((n) => n > 0)) setPrefs({ quickAmounts: next })
  }
  const custom = prefs.quickAmounts.some((n, i) => n !== DEFAULT_PREFS.quickAmounts[i])
  return (
    <SettingsCard
      title={t('settings.quickAmounts.title')}
      help={t('settings.quickAmounts.help')}
      action={
        custom ? (
          <CardAction onClick={() => setPrefs({ quickAmounts: DEFAULT_PREFS.quickAmounts })}>
            {t('settings.quickAmounts.reset')}
          </CardAction>
        ) : undefined
      }
    >
      <div className="grid grid-cols-4 gap-2">
        {prefs.quickAmounts.map((n, i) => (
          <MoneyInput
            key={i}
            value={n}
            onChange={(v) => set(i, v)}
            label={t('settings.quickAmounts.label', { n: i + 1 })}
          />
        ))}
      </div>
    </SettingsCard>
  )
}

function WidgetsCard() {
  const prefs = usePrefs()
  const toggle = (id: string, on: boolean) =>
    setPrefs({
      hiddenWidgets: on
        ? prefs.hiddenWidgets.filter((w) => w !== id)
        : [...prefs.hiddenWidgets, id],
    })
  return (
    <SettingsCard
      title={t('settings.widgets.title')}
      help={t('settings.widgets.help')}
    >
      <div className="space-y-3">
        {ADD_WIDGETS.map((w) => (
          <Switch
            key={w.id}
            label={w.label()}
            help={w.help()}
            checked={!prefs.hiddenWidgets.includes(w.id)}
            onChange={(on) => toggle(w.id, on)}
          />
        ))}
      </div>
    </SettingsCard>
  )
}

function WarningsCard() {
  const prefs = usePrefs()
  const dismissed = useDismissedCount()
  return (
    <SettingsCard
      title={t('settings.warnings.title')}
      help={t('settings.warnings.help')}
      tour="settings-warnings"
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[15px] text-white">{t('settings.warnings.nearLabel')}</p>
          <Segments
            value={String(prefs.nearRatio)}
            onChange={(v) => setPrefs({ nearRatio: Number(v) })}
            options={[
              { value: '0.7', label: '70%' },
              { value: '0.8', label: '80%' },
              { value: '0.9', label: '90%' },
            ]}
          />
        </div>
        <Switch
          label={t('settings.warnings.pace')}
          help={t('settings.warnings.paceHelp')}
          checked={prefs.paceWarnings}
          onChange={(v) => setPrefs({ paceWarnings: v })}
        />
        {dismissed > 0 && (
          <button
            type="button"
            onClick={resetDismissedAlerts}
            className="text-sm font-semibold text-accent-soft hover:underline"
          >
            {t('settings.warnings.bringBack', { count: dismissed })}
          </button>
        )}
      </div>
    </SettingsCard>
  )
}

/* ---------- savings ---------- */

function SavingsSettings({
  available,
  accounts,
  goals,
}: {
  available: boolean
  accounts: number
  goals: number
}) {
  const { data: goal, isLoading } = useGoal()
  const upsertGoal = useUpsertGoal()
  if (available) {
    return (
      <Link
        to="/savings"
        className="group flex items-center gap-3 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 hover:bg-white/[0.07] lg:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-white">{t('settings.savings.title')}</span>
          <span className="block text-xs text-muted">
            {t('settings.savings.summary', {
              accounts: t('settings.savings.accounts', { count: accounts }),
              goals: t('settings.savings.goals', { count: goals }),
            })}
          </span>
        </span>
        <CaretRight aria-hidden className="text-muted transition group-hover:translate-x-0.5" />
      </Link>
    )
  }
  return (
    <SettingsCard title={t('settings.savings.goalTitle')} help={t('settings.savings.goalHelp')}>
      {/* keyed so the fields fill in once the goal has loaded, rather than
          keeping empty defaults that "Save goal" would write over it */}
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <GoalEditor
          key={goal?.id ?? 'new'}
          goal={goal ?? null}
          onSave={(next) => upsertGoal.mutate({ id: goal?.id, ...next })}
        />
      )}
    </SettingsCard>
  )
}

/* ---------- data and account ---------- */

function DataCard({ categories }: { categories: Category[] }) {
  const [state, setState] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  })
  const run = async () => {
    setState({ busy: true, message: null })
    try {
      const count = await downloadCsv(categories)
      setState({
        busy: false,
        message: t('settings.data.downloaded', { count, formatted: formatAmount(count) }),
      })
    } catch (err) {
      setState({
        busy: false,
        message: t('settings.data.failed', { error: (err as Error).message }),
      })
    }
  }
  return (
    <SettingsCard title={t('settings.data.title')} help={t('settings.data.help')}>
      <button
        type="button"
        onClick={run}
        disabled={state.busy}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-50"
      >
        <DownloadSimple aria-hidden />
        {state.busy ? t('settings.data.preparing') : t('settings.data.download')}
      </button>
      {state.message && <p className="mt-2 text-xs text-muted">{state.message}</p>}
    </SettingsCard>
  )
}

/* ---------- AI ---------- */

const AI_STUDIO = 'https://aistudio.google.com/apikey'

/**
 * The Gemini key behind Advice, the plan draft and Ask. GEMINI_API_KEY on the
 * server wins; without it, one pasted here is checked with Google and kept in
 * the database, where only the server functions can read it.
 */
function AiCard() {
  const status = useGeminiKey()
  const save = useSaveGeminiKey()
  const [draft, setDraft] = useState('')
  const [replacing, setReplacing] = useState(false)

  // plain `npm run dev` has no server functions: nothing to set here
  if (status.error instanceof GeminiKeyUnavailableError) return null

  const current = status.data
  const editable = current?.canStore && current.source !== 'server'
  const showInput = editable && (current.source === null || replacing)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    save.mutate(draft.trim(), {
      onSuccess: () => {
        setDraft('')
        setReplacing(false)
      },
    })
  }

  return (
    <SettingsCard title={t('settings.ai.title')} help={t('settings.ai.help')}>
      {status.isPending ? (
        <p className="text-sm text-muted">{t('settings.ai.checking')}</p>
      ) : status.error ? (
        <p className="text-sm text-red-300">{(status.error as Error).message}</p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm">
            <Sparkle
              aria-hidden
              weight={current?.source ? 'fill' : 'regular'}
              className={current?.source ? 'text-positive' : 'text-muted'}
            />
            <span className={current?.source ? 'text-slate-200' : 'text-muted'}>
              {current?.source === 'server'
                ? t('settings.ai.fromServer', { hint: current.hint ?? '' })
                : current?.source === 'app'
                  ? t('settings.ai.saved', { hint: current.hint ?? '' })
                  : t('settings.ai.none')}
            </span>
          </p>

          {!current?.canStore && current?.source !== 'server' && (
            <p className="text-xs leading-relaxed text-amber-200">{t('settings.ai.cantStore')}</p>
          )}

          {showInput && (
            <form onSubmit={submit} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    if (save.error) save.reset()
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t('settings.ai.placeholder')}
                  aria-label={t('settings.ai.placeholder')}
                  className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2.5 font-mono text-sm text-white outline-none ring-1 ring-white/10 placeholder:font-sans placeholder:text-muted/60 focus:ring-white/40"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || save.isPending}
                  className="shrink-0 rounded-xl bg-slate-50 px-4 text-sm font-semibold text-ink disabled:opacity-40"
                >
                  {save.isPending ? t('settings.ai.checkingKey') : t('settings.ai.save')}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                <Trans
                  k="settings.ai.getKey"
                  tags={{
                    link: (s) => (
                      <a
                        href={AI_STUDIO}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent-soft underline underline-offset-2"
                      >
                        {s}
                      </a>
                    ),
                  }}
                />
              </p>
            </form>
          )}

          {save.error && <p className="text-sm text-red-300">{(save.error as Error).message}</p>}

          {editable && current.source === 'app' && (
            <div className="flex flex-wrap gap-2">
              {!replacing && (
                <button
                  type="button"
                  onClick={() => setReplacing(true)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
                >
                  {t('settings.ai.replace')}
                </button>
              )}
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate(null)}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-red-300 ring-1 ring-red-400/30 hover:bg-red-500/10 disabled:opacity-40"
              >
                <Trash aria-hidden /> {t('settings.ai.remove')}
              </button>
            </div>
          )}
        </div>
      )}
    </SettingsCard>
  )
}

function HelpCard() {
  return (
    <SettingsCard title={t('settings.help.title')} help={t('settings.help.help')}>
      <button
        type="button"
        onClick={() => tourStore.start('/settings')}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
      >
        <Compass aria-hidden /> {t('settings.help.tour')}
      </button>
    </SettingsCard>
  )
}

function AccountCard() {
  const { session } = useSession()
  return (
    <SettingsCard
      title={t('settings.account.title')}
      help={
        session?.user.email
          ? t('settings.account.signedInAs', { email: session.user.email })
          : undefined
      }
    >
      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
      >
        <SignOut aria-hidden /> {t('settings.account.signOut')}
      </button>
    </SettingsCard>
  )
}

/* ---------- before migration 0007: the single goal ---------- */

interface GoalProps {
  goal: { id: string; name: string; target_amount: number; current_amount: number } | null
  onSave: (goal: { name: string; target_amount: number; current_amount: number }) => void
}

function GoalEditor({ goal, onSave }: GoalProps) {
  const [name, setName] = useState(goal?.name ?? t('settings.savings.defaultGoalName'))
  const [target, setTarget] = useState(String(goal?.target_amount ?? 0))
  const [current, setCurrent] = useState(String(goal?.current_amount ?? 0))

  const num = (v: string) => roundMoney(Number.parseFloat(v.replace(',', '.')) || 0)
  const progress = num(target) > 0 ? Math.min(num(current) / num(target), 1) * 100 : 0

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('settings.savings.goalName')}
        aria-label={t('settings.savings.goalName')}
        className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] font-medium text-white outline-none ring-1 ring-white/10"
      />
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-muted">{t('settings.savings.saved')}</span>
          <input
            value={current}
            onChange={(e) => setCurrent(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/10"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs text-muted">{t('settings.savings.target')}</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/10"
          />
        </label>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted">
        {t('settings.savings.progress', {
          saved: formatMoney(num(current)),
          target: formatMoney(num(target)),
          percent: Math.round(progress),
        })}
      </p>

      <button
        type="button"
        onClick={() =>
          onSave({
            name: name.trim() || t('settings.savings.goalFallback'),
            target_amount: num(target),
            current_amount: num(current),
          })
        }
        className="w-full rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-ink"
      >
        {goal ? t('settings.savings.save') : t('settings.savings.create')}
      </button>
    </div>
  )
}
