# Finance Tracker — Design System Contract

**Every agent working on this branch MUST read this file and follow it exactly.**
Do not invent new colours, sizes, spacing, or components. If something is missing here,
use the closest thing listed. Do not add a new dependency.

---

## 0. Who uses this app

Field collection agents and small shop owners in Tamil Nadu.
- They hold a phone in one hand, often outdoors, often in sunlight.
- Many read Tamil more comfortably than English.
- They care about **one number** (how much) and **one action** (record it).

Design consequences, in priority order:

1. **Numbers are the loudest thing on the screen.** Bigger than any heading.
2. **Buttons are large, coloured, and carry an icon.** An icon + a number should be
   understandable with the text covered.
3. **Every label is bilingual.** Tamil first (larger), English second (smaller, muted).
4. **Colour carries meaning, never decoration.** Green = money in / confirmed.
   Red = money out / rejected. Amber = waiting. Blue = neutral action.
5. **No horizontal scrolling, ever, on a phone.**

---

## 1. Breakpoints

Mobile is the default. Write the phone styles with NO prefix, then add `md:` for desktop.
Never write `hidden md:block` as a way to hide mobile complexity — build the mobile version.

- base  = phone (assume 360px wide)
- `md:` = 768px and up (tablet / desktop)

---

## 2. Colour tokens (defined in `app/globals.css`)

Use the token. NEVER write `bg-white`, `text-gray-700`, `bg-green-100`, `text-orange-600`
or any other raw Tailwind palette class in feature code.

| Token | Meaning | Use for |
|---|---|---|
| `background` / `foreground` | page | page shell |
| `card` / `card-foreground` | raised surface | every panel |
| `primary` / `primary-foreground` | brand blue | the single main action on a screen |
| `secondary` | quiet surface | secondary buttons |
| `muted` / `muted-foreground` | de-emphasis | captions, English sub-labels |
| `border` / `input` / `ring` | lines and focus | — |
| `success` / `success-foreground` / `success-muted` | money IN, confirmed, present | collection amounts, CONFIRMED, PRESENT |
| `warning` / `warning-foreground` / `warning-muted` | waiting | PENDING, LATE, PARTIALLY_PAID |
| `danger` / `danger-foreground` / `danger-muted` | money OUT, failed | REJECTED, ABSENT, CANCELLED, shortfall |
| `info` / `info-foreground` / `info-muted` | neutral fact | OPEN, SUBMITTED, counts |
| `chart-1` … `chart-5` | five DISTINCT hues | Recharts only |

Both light and dark values are defined. Dark mode is live via `ThemeProvider`.

---

## 3. Size scale — TOUCH FIRST

Minimum touch target is **48px** for anything that is a screen's primary or
secondary action. The one permitted exception is a button that sits *inside* a
list row, where 48px would make rows unusably tall: those may drop to **44px**
(the Apple HIG floor), never lower. An earlier version of this table said 40px,
which contradicted the 48px rule two lines above it — 44px is the resolution.

| Element | Phone | Desktop (`md:`) |
|---|---|---|
| Primary action button | `h-14` (56px) | `h-12` |
| Normal button | `h-12` (48px) | `h-10` |
| Small button (only inside a row) | `h-11` (44px) | `h-9` |
| Icon-only button | `size-12` | `size-10` |
| Input / Select / Textarea row | `h-14` (56px) | `h-11` |
| Nav / list row | `min-h-14` | — |

Input font size must be `text-base` (16px) on phone. Smaller causes iOS zoom-on-focus.

---

## 4. Number typography

Money and counts use `font-variant-numeric: tabular-nums` so digits do not jump.

| Variant | Class | Use |
|---|---|---|
| `hero` | `text-4xl font-bold tabular-nums` | the one number a screen is about |
| `stat` | `text-2xl font-bold tabular-nums` | KPI tiles |
| `row` | `text-base font-semibold tabular-nums` | amounts inside a list row |
| `caption` | `text-sm tabular-nums text-muted-foreground` | secondary numbers |

Always render money through `<Money>` from `components/ui/money.tsx`.
It formats Indian style (₹1,23,456.00 — lakh grouping, `en-IN`) and colours by sign/intent.
Never call `.toLocaleString()` directly in feature code.

---

## 5. Bilingual labels

All user-facing text comes from `lib/i18n.ts`:

```ts
import { t } from '@/lib/i18n'
t('collections')  // => { ta: 'வசூல்', en: 'Collections' }
```

Render with `<Bi>` from `components/ui/bi.tsx`:
- `<Bi k="collections" />`         → Tamil line, English line under it, muted+smaller
- `<Bi k="collections" inline />`  → "வசூல் · Collections" on one line
- `<Bi k="collections" only="ta" />` → Tamil only

Rules:
- Tamil is the primary line. English is the secondary, `text-xs text-muted-foreground`.
- Buttons, nav items, table headers, status badges, and form labels are ALL bilingual.
- Do NOT translate: proper nouns, codes (COL-001), amounts, dates.
- If a key is missing from `lib/i18n.ts`, ADD it. Do not hardcode a string.

---

## 6. Shared components — use these, do not rebuild

All live in `components/ui/`. The design-system agent creates them first.

| Component | Purpose |
|---|---|
| `<Money value size intent />` | every rupee amount. `size`: hero/stat/row/caption. `intent`: in/out/neutral/auto |
| `<Bi k inline only />` | every bilingual label |
| `<StatTile icon label value intent href />` | big tappable KPI card. Number dominates. |
| `<StatusBadge status />` | maps ANY status string to the right colour + bilingual text. Single source of truth. |
| `<ActionButton icon label sublabel intent size />` | the big coloured primary action |
| `<DataList items renderCard columns />` | **renders cards on phone and a table on `md:`** from one definition |
| `<EmptyState icon title action />` | every empty list |
| `<PageHeader title action />` | screen title + one primary action |
| `<FormField label required error>` | label + control + error, bilingual, 56px row |
| `<StickyActionBar>` | fixed bottom bar above the tab bar, holds the primary submit |

**`<DataList>` is how we kill horizontal scroll.** Every list screen uses it.
No feature file may contain a raw `<table>` element.

---

## 7. Status → colour map (canonical, in `<StatusBadge>`)

| Status | Token | Tamil |
|---|---|---|
| CONFIRMED, PAID, APPROVED, VERIFIED, PRESENT, ACTIVE | success | உறுதி / செலுத்தப்பட்டது / ஒப்புதல் / சரிபார்க்கப்பட்டது / வந்தார் |
| PENDING, SUBMITTED, PARTIALLY_PAID, LATE, HALF_DAY | warning | காத்திருப்பு / சமர்ப்பிக்கப்பட்டது / பகுதி / தாமதம் / அரை நாள் |
| REJECTED, CANCELLED, ABSENT, OVERDUE, INACTIVE | danger | நிராகரிப்பு / ரத்து / வரவில்லை / தவணை தாண்டியது |
| OPEN, DRAFT | info | நிலுவை |

---

## 8. Layout shell

- **Phone**: fixed **bottom tab bar**, max 5 items, icon + short Tamil label, 64px tall,
  padded with `env(safe-area-inset-bottom)`. Top bar is compact (56px): screen title +
  notification bell + avatar. No hamburger for the main items.
- **Overflow items** (more than 5) go into a "மேலும் / More" sheet on the 5th tab.
- **Desktop `md:`**: the existing left sidebar, bottom bar hidden.
- Main content gets `pb-24 md:pb-6` so the tab bar never covers the last row.

---

## 9. Network and feedback rules

- Every `fetch` goes through `apiFetch()` in `lib/api-client.ts`. It try/catches,
  shows a bilingual toast on failure, and always resolves.
- Every submit button shows a spinner AND stays disabled only while in-flight.
  On any error the button must become enabled again.
- Optimistic UI is not allowed for money. Wait for the server.

---

## 10. Accessibility / field conditions

- Text contrast must pass WCAG AA (4.5:1). Assume bright sunlight.
- Every icon-only button needs `aria-label` (English is fine there).
- Focus rings stay visible — do not remove `focus-visible:ring`.
- Do not rely on colour alone: a status is always colour + icon + word.
