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
