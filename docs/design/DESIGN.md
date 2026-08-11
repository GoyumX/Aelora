# Aelora Design System

## Direction

Aelora should feel calm, precise, and optimistic: an operations interface grounded in energy data rather than a generic admin template. Deep teal provides the dependable product identity, solar amber highlights generation, green communicates healthy energy flow, indigo separates model output from measured data, and red is reserved for faults requiring attention.

The shell is deliberately information-dense enough for monitoring while retaining generous spacing around page titles and decisions. Cards use restrained borders and shadows so charts and exceptions can carry the visual weight in later phases.

## Foundations

- Typography: Geist Sans for interface and headings; Geist Mono for measurements, timestamps, IDs, and model values.
- Spacing: Tailwind's 4 px base rhythm. Controls have at least a 40 px target; primary mobile actions should use 44 px or more.
- Shape: 12 px base radius, with smaller radii for nested controls and larger radii for major surfaces.
- Motion: short color and transform transitions only. Decorative activity respects `prefers-reduced-motion`.
- Icons: Lucide, normally 16–20 px, always paired with text or an accessible name when actionable.

## Semantic color usage

| Token | Purpose |
| --- | --- |
| `primary` | Brand actions, selected navigation, focus emphasis |
| `solar` | Generation and irradiance data |
| `energy` | Healthy flow, connected state, successful operation |
| `forecast` | AI predictions and confidence bands |
| `alert-warning` | Degraded state needing review |
| `alert-critical` | Fault, outage, or urgent anomaly |

Never communicate state using color alone. Pair it with a label, icon, pattern, or number. Text variants named `*-strong` are designed for readable foreground use; the brighter base tokens are primarily chart marks and decorative fills.

## Components

- App shell: persistent desktop sidebar, compact mobile drawer, sticky site and account header, keyboard skip link, and a focused main landmark.
- Navigation: two user-facing groups—Workspace and System. Configuration children appear when their parent section is active.
- Page header: eyebrow, single `h1`, concise purpose statement, and visible implementation or system status.
- Cards: title, supporting description, then the content. Avoid nested cards and unnecessary containers.
- Status: use badge plus icon/text. Critical alert counts may use red because the number and Alerts label supply redundant meaning.

## Accessibility contract

- WCAG 2.2 AA is the target.
- All interactive elements must be keyboard reachable and have visible focus.
- The shell has a skip link, named navigation, semantic header/main regions, and `aria-current` on the exact active page.
- Light and dark themes preserve semantic meaning and readable foreground pairs.
- Charts added later require text summaries, units, accessible tooltips, and non-color differentiation.

## Responsive behavior

- Below `lg`, the sidebar becomes a sheet opened by a named menu button.
- Content padding scales from 16 px to 32 px.
- Page foundation cards stack, then form three columns from `md` upward.
- Long site and user labels truncate without hiding their accessible names.

## Role boundary

The current navigation is the authenticated user shell. Admin-only model management, simulator controls, user management, and audit tools should be introduced as a separately authorized navigation group after authentication and RBAC are implemented; hiding a link alone is never authorization.
