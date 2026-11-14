import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { hashToken } from './_tokens'
import categories from './v1/categories'
import expenses from './v1/expenses'
import month from './v1/month'
import summary from './v1/summary'

/*
 * The api/v1 functions against a stand-in for Supabase's REST API: who gets
 * in, what each key may do, and that a repeated request adds nothing.
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const READ = 'bud_read-key'
const WRITE = 'bud_write-key-for-anna'
const REVOKED = 'bud_revoked-key'

type Row = Record<string, unknown>
let db: { tokens: Row[]; expenses: Row[]; patched: string[] }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function supabase(input: string | URL | Request, init?: RequestInit): Response {
  const url = new URL(String(input))
  const table = url.pathname.replace('/rest/v1/', '')
  const q = url.searchParams
  if ((init?.headers as Record<string, string>)?.apikey !== 'service-secret') return json({}, 401)
  if (table === 'api_tokens') {
    if (init?.method === 'PATCH') {
      db.patched.push((q.get('id') ?? '').replace('eq.', ''))
      return json([])
    }
    const hash = (q.get('token_hash') ?? '').replace('eq.', '')
    return json(db.tokens.filter((t) => t.token_hash === hash && !t.revoked_at))
  }
  if (table === 'categories') {
    return json([
      { id: id(1), name: 'Food', color: '#111111', monthly_limit: 1000, sort_order: 1, archived: false, kind: 'monthly', owner: null },
      { id: id(2), name: 'Trip', color: '#222222', monthly_limit: 0, sort_order: 2, archived: false, kind: 'project', owner: null },
      { id: id(3), name: 'Old', color: '#333333', monthly_limit: 50, sort_order: 3, archived: true, kind: 'monthly', owner: null },
    ])
  }
  if (table === 'people') return json([{ id: 'anna', name: 'Anna' }, { id: 'lukasz', name: 'Łukasz' }])
  if (table === 'budgets') return json([])
  if (table === 'incomes') return json([{ amount: 5000 }])
  if (table === 'expenses') {
    if (init?.method === 'POST') {
      const row = JSON.parse(String(init.body)) as Row
      if (db.expenses.some((e) => e.id === row.id)) return json({ code: '23505' }, 409)
      const stored = { ...row, created_at: '2026-11-13T10:00:00Z' }
      db.expenses.push(stored)
      return json([stored], 201)
    }
    const wanted = q.get('id')?.replace('eq.', '')
    if (wanted) return json(db.expenses.filter((e) => e.id === wanted))
    const [from, to] = q.getAll('expense_date').map((v) => v.slice(4))
    return json(db.expenses.filter((e) => (e.expense_date as string) >= from && (e.expense_date as string) <= to))
  }
  return json({ message: `unexpected ${table}` }, 500)
}

async function call(
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
  options: { method?: string; token?: string; query?: Row; body?: unknown; headers?: Record<string, string> } = {},
) {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> }
  const res = {
    setHeader: (key: string, value: string) => ((out.headers[key] = value), res),
    status: (code: number) => ((out.status = code), res),
    json: (body: unknown) => ((out.body = body), res),
  }
  await handler(
    {
      method: options.method ?? 'GET',
      query: options.query ?? {},
      body: options.body,
      headers: {
        host: 'budget.example',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
    } as unknown as VercelRequest,
    res as unknown as VercelResponse,
  )
  return out as { status: number; body: any; headers: Record<string, string> } // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-13T09:00:00Z'))
  vi.stubEnv('SUPABASE_URL', 'https://db.example')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-secret')
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => supabase(input, init)))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  db = {
    patched: [],
    tokens: [
      { id: id(101), name: 'Dashboard', scopes: ['read'], person: null, last_used_at: null, revoked_at: null, token_hash: hashToken(READ) },
      { id: id(102), name: 'Quick add', scopes: ['read', 'write'], person: 'anna', last_used_at: '2026-11-13T08:30:00Z', revoked_at: null, token_hash: hashToken(WRITE) },
      { id: id(103), name: 'Lost phone', scopes: ['read', 'write'], person: null, last_used_at: null, revoked_at: '2026-11-01T00:00:00Z', token_hash: hashToken(REVOKED) },
    ],
    expenses: [
      { id: id(201), amount: 850, category_id: id(1), person: 'anna', note: 'private note', expense_date: '2026-11-05', created_at: '2026-11-05T10:00:00Z' },
      { id: id(202), amount: 400, category_id: id(2), person: 'anna', note: null, expense_date: '2026-11-06', created_at: '2026-11-06T10:00:00Z' },
    ],
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('who gets in', () => {
  it('answers the same for a missing, unknown, malformed and revoked key', async () => {
    for (const token of [undefined, 'bud_nobody', 'service-secret', REVOKED, 'bud_' + 'x'.repeat(200)]) {
      for (const handler of [summary, month, categories, expenses]) {
        const res = await call(handler, { token })
        expect([res.status, res.body], String(token)).toEqual([401, { error: 'unauthorized' }])
        expect(res.headers['cache-control']).toBe('no-store')
      }
    }
    expect(db.expenses).toHaveLength(2)
  })

  it('keeps a read key from adding and every key to its methods', async () => {
    const refused = await call(expenses, { method: 'POST', token: READ, body: { amount: 5, category_id: id(1), person: 'anna' } })
    expect([refused.status, refused.body.error]).toEqual([403, 'scope_required'])
    expect((await call(expenses, { token: WRITE })).status).toBe(405)
    expect((await call(summary, { method: 'POST', token: READ })).status).toBe(405)
    expect(db.expenses).toHaveLength(2)
  })

  it('says so when the server has no secret key, without asking Supabase', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const res = await call(summary, { token: READ })
    expect([res.status, res.body.error]).toEqual([503, 'server_not_configured'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('notes a key was used, at most hourly', async () => {
    await call(summary, { token: READ })
    await call(summary, { token: WRITE })
    expect(db.patched).toEqual([id(101)])
  })
})

describe('reading the month', () => {
  it('sums the month without notes and links back to the app', async () => {
    const res = await call(summary, { token: READ })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      month: '2026-11',
      today: '2026-11-13',
      income: { received: 5000, planned: null },
      spending: { spent: 850, limit: 1000, remaining: 150, projects: 400 },
      categories: { over: 0, near: 1 },
      last_expense: { date: '2026-11-05', amount: 850, category: 'Food' },
      links: { app: 'https://budget.example', budget: 'https://budget.example/budget' },
    })
    expect(JSON.stringify(res.body)).not.toContain('private note')
    expect((await call(summary, { token: READ, query: { month: '2026-10' } })).body.spending.spent).toBe(0)
    for (const bad of ['2026-13', 'now', ['2026-11', '2026-10']]) {
      expect((await call(summary, { token: READ, query: { month: bad } })).status).toBe(400)
      expect((await call(month, { token: READ, query: { month: bad } })).status).toBe(400)
    }
  })

  it('lists the monthly categories against their limits', async () => {
    const res = await call(month, { token: READ })
    expect(res.body.categories).toEqual([
      expect.objectContaining({ name: 'Food', limit: 1000, spent: 850, remaining: 150, level: 'near', link: `https://budget.example/category/${id(1)}` }),
    ])
    const list = await call(categories, { token: WRITE })
    expect(list.body).toMatchObject({ person: 'anna', can_add: true, categories: [{ id: id(1), name: 'Food' }] })
    expect((await call(categories, { token: READ })).body).toMatchObject({ person: null, can_add: false })
  })
})

describe('adding an expense', () => {
  const post = (body: unknown, headers?: Record<string, string>, token = WRITE) =>
    call(expenses, { method: 'POST', token, body, headers })

  it('adds for the key’s person, today, and answers with the category after it', async () => {
    const res = await post({ amount: 160.5, category_id: id(1), note: ' bread ' })
    expect(res.status).toBe(201)
    expect(res.body.expense).toMatchObject({ amount: 160.5, person: 'anna', note: 'bread', expense_date: '2026-11-13' })
    expect(res.body.category).toMatchObject({ spent: 1010.5, remaining: -10.5, level: 'over' })
    expect(db.expenses).toHaveLength(3)
  })

  it('adds once for a repeated request and refuses a reused key', async () => {
    const key = { 'idempotency-key': id(777).toUpperCase() }
    const body = { amount: 20, category_id: id(1) }
    const first = await post(body, key)
    const again = await post(body, key)
    expect([first.status, again.status]).toEqual([201, 200])
    expect(again.body).toMatchObject({ repeat: true, expense: { id: id(777), amount: 20 } })
    expect(again.body.category.spent).toBe(870)
    const other = await post({ ...body, amount: 21 }, key)
    expect([other.status, other.body.error]).toEqual([409, 'idempotency_conflict'])
    // an id that belongs to an expense made in the app is not handed over either
    const taken = await post(body, { 'idempotency-key': id(201) })
    expect(taken.status).toBe(409)
    expect(JSON.stringify(taken.body)).not.toContain('private note')
    expect(db.expenses).toHaveLength(3)
    expect((await post(body, { 'idempotency-key': 'not-a-uuid' })).status).toBe(400)
  })

  it('refuses what the budget would not take, and adds nothing', async () => {
    const cases: [unknown, string][] = [
      [{ amount: -5, category_id: id(1) }, 'invalid_amount'],
      [{ amount: 5, category_id: id(2) }, 'invalid_category'],
      [{ amount: 5, category_id: id(3) }, 'invalid_category'],
      [{ amount: 5, category_id: id(1), person: 'lukasz' }, 'person_not_allowed'],
      [{ amount: 5, category_id: id(1), date: '2026-11-14' }, 'invalid_date'],
      [{ amount: 5, category_id: id(1), id: id(9) }, 'unknown_field'],
      [undefined, 'invalid_body'],
    ]
    for (const [body, error] of cases) {
      const res = await post(body)
      expect([res.status, res.body.error], error).toEqual([400, error])
    }
    expect(db.expenses).toHaveLength(2)
  })

  it('fails closed when Supabase does', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'down' }, 500)))
    const res = await post({ amount: 5, category_id: id(1) })
    expect([res.status, res.body]).toEqual([502, { error: 'upstream_failed' }])
  })
})
