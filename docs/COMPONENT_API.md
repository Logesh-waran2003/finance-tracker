# Component API — what Phase 2 must build against

Read `docs/DESIGN_SYSTEM.md` first for the rules. This file is the exact API.
These all exist and type-check today. Do not rebuild any of them. Do not modify them.

## Formatting — `lib/format.ts`
```ts
formatMoney(value: string | number, opts?: { decimals?: boolean; compact?: boolean }): string
toNumber(value: string | number): number        // comparison/grouping ONLY, never display
moneySign(value: string | number): -1 | 0 | 1
formatDate(d, style?: 'short'|'medium'|'long'|'day'|'month'): string   // Asia/Kolkata
formatDateTime(d): string
formatTime(d): string
formatCount(n: number): string
formatPercent(n: number, decimals?: number): string
```
**`.toLocaleString()` is banned in feature code.** Money arrives from Drizzle `numeric`
columns as STRINGS — pass the string straight to `<Money>` / `formatMoney`.

## Bilingual — `lib/i18n.ts`
```ts
interface Label { ta: string; en: string }
type LabelKey            // 289 keys already defined
t(k: LabelKey): Label
statusLabel(status: string): Label   // resolves every pgEnum value; safe fallback
```
If a key is missing, ADD it to `lib/i18n.ts` in the same natural-spoken-Tamil register.
Never hardcode a user-facing string.

## Components — `components/ui/*`
```tsx
<Money value={string|number} size?='hero'|'stat'|'row'|'caption' intent?='in'|'out'|'neutral'|'auto' compact? decimals? />
<Bi k?={LabelKey} label?={Label} inline? only?='ta'|'en' />
<StatusBadge status={string} compact? />        // + statusIntent(status), STATUS_INTENT
<StatTile icon?={LucideIcon} labelKey?={LabelKey} label?={Label} value={string|number}
          kind?='money'|'count' intent?='primary'|'success'|'warning'|'danger'|'info'|'neutral'
          captionKey?={LabelKey} caption?={ReactNode} href? onClick? compact? />
<ActionButton icon?={LucideIcon} labelKey?={LabelKey} sublabelKey?={LabelKey}
              intent?=... amount?={string|number} loading? size?='default'|'lg' ...buttonProps />
<DataList items={readonly T[]} getKey={(t,i)=>string} columns={DataListColumn<T>[]}
          renderCard?={(t,i)=>ReactNode} onRowClick?={(t,i)=>void}
          empty?={ReactNode} loading?={boolean} skeletonRows?={number} />
<EmptyState icon?={LucideIcon} titleKey?={LabelKey} descriptionKey?={LabelKey} action?={ReactNode} />
<PageHeader titleKey?={LabelKey} subtitle?={ReactNode} action?={ReactNode} back? backHref? sticky? />
<FormField labelKey?={LabelKey} htmlFor?={string} required? error?={string|Label|null} hint?={ReactNode}>
  {control}
</FormField>
<StickyActionBar aboveTabBar?={boolean}>{buttons}</StickyActionBar>
```

`DataListColumn<T>`:
```ts
{ key: string; header: ReactNode; cell: (item: T, i: number) => ReactNode
  align?: 'left'|'center'|'right'; hideOnMobile?: boolean; primary?: boolean; className?: string }
```
With no `renderCard`, the phone card is derived: the `primary` (or first) column is the
headline, the first `align="right"` column is the trailing value, the rest become a
label/value list. **`<DataList>` replaces every raw `<table>`. A raw `<table>` in a feature
file is a review failure.**

## Network — `lib/api-client.ts`
```ts
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number; offline: boolean }
apiFetch<T>(url, init?: RequestInit & { timeoutMs?: number; toastOnError?: boolean }): Promise<ApiResult<T>>
apiGet<T>(url) ; apiPost<T>(url, body) ; apiPatch<T>(url, body) ; apiDelete<T>(url)
useOnlineStatus(): boolean
```
**Never rejects.** Always:
```ts
const res = await apiPost<Row>('/api/collections', payload)
if (!res.ok) { setSaving(false); return }   // toast already shown
```
Raw `fetch(` in a feature file is a review failure.

## Offline — `lib/offline-queue.ts`
```ts
enqueue(item: QueuedRequest): Promise<void>
flushQueue(): Promise<{ sent: number; failed: number }>
useQueueCount(): number
type QueuedRequest = { id, url, method, body, idempotencyKey, createdAt, attempts, failed? }
```
**Idempotency contract — this is what keeps money safe:**
1. Generate the key ONCE per form open: `const [idempotencyKey] = useState(() => crypto.randomUUID())`
2. Send the SAME string as `idempotency_key` in the body and as `idempotencyKey` on the queued item.
3. New key only when the form reopens for a new record.

`POST /api/collections` inserts with `ON CONFLICT DO NOTHING`, so a replay returns the
existing row instead of creating a second collection. **Regenerating the key per tap creates
duplicate money.** This is exactly the bug being fixed in `collection-form.tsx`.

## Session typing — `types/next-auth.d.ts`
`session.user.role`, `.branch_id`, `.employee_code` are now typed.
**Delete every `(session.user as any).role` cast in files you own.**

## Layout facts
- `<ThemeProvider>` is live, so dark mode works for the first time. **Check your screens in dark mode.**
- Bottom tab bar is 64px + safe area. Give scrollable page content `pb-24 md:pb-6`.
- `<StickyActionBar>` already offsets above the tab bar by default.
