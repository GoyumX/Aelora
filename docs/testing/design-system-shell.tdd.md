# Design System and Application Shell — TDD Evidence

Date: 2026-08-11  
Branch: `dev`

## Scope

The tests define the application navigation contract, active navigation behavior, accessible header controls, shell landmarks, and reusable route foundation.

## RED evidence

The first test run failed because `lib/navigation`, `AppSidebar`, and `AppHeader` did not exist. That contract was recorded in commit `135c0ea`.

The page-foundation test then failed with:

```text
Failed to resolve import "@/components/shell/page-placeholder"
Test Files 1 failed | 1 passed
Tests 1 passed
```

This confirmed the new test could not pass before the shared route component was implemented.

## GREEN evidence

After implementing the shell and route foundation:

```text
Test Files 5 passed (5)
Tests 9 passed (9)
```

Coverage gate:

```text
Statements 86.36%
Branches   80.76%
Functions  93.33%
Lines      85.71%
```

The coverage scope targets Aelora-owned shell and navigation primitives rather than generated shadcn/ui source.

## Accessibility assertions

- Primary navigation has an accessible name.
- The exact active route exposes `aria-current="page"`.
- Site selector, notifications, user menu, mobile navigation, and theme controls have accessible names.
- A keyboard skip link targets the main landmark.
- Each route foundation has a single named level-one heading and visible status text.

## Dropdown group-context regression — 2026-08-25

Opening either header dropdown previously mounted a Base UI `MenuGroupLabel` without the required `Menu.Group` ancestor. The initial render test did not expose the error because portal content mounts only when a trigger is opened.

RED command and evidence:

```text
npm test -- --run components/shell/app-header.test.tsx --reporter=verbose --maxWorkers=1
Test Files  1 failed (1)
Tests       1 failed | 1 passed (2)
Unhandled  Base UI: MenuGroupContext is missing
```

Both dropdown contents now wrap their label, separator, and items in `DropdownMenuGroup`. The same focused test then passed both tests. A Playwright test opens both real portal menus and confirms their items are visible.

Final evidence:

```text
Focused component tests  2 passed
Browser click path       1 passed
Full suite               78 files; 280 tests passed
ESLint                   passed
TypeScript               passed
Production build         passed
```

Coverage was not rerun for this small composition fix. No checkpoint commits were created because Git history remains user-controlled.
