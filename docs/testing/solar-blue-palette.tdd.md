# Solar Blue Palette — TDD Evidence

Date: 2026-08-07  
Branch: `dev`

## User journey

As an Aelora user, I want the interface to feel connected to solar technology without covering every surface in green, so that operational status colors remain meaningful and the product feels calm and professional.

## Palette contract

- Deep and mid blue: brand, navigation, primary actions, and high-emphasis surfaces.
- Pale sky blue: light backgrounds, secondary surfaces, and selected navigation.
- Amber: sunlight and solar production.
- Green: healthy generation, connected state, and other positive energy status only.
- Violet-blue: AI forecasts and model output.
- Red and amber: critical and warning alerts.

The same semantic roles apply in light and dark mode. Text and controls retain visible focus treatment and WCAG-oriented foreground/background contrast.

## RED evidence

Commit `9103eb1` records two failing tests. They detected the green-hued global foundation and the hard-coded dark-green landing and authentication surfaces.

```text
Test Files 1 failed (1)
Tests      2 failed (2)
```

## GREEN evidence

The global theme tokens, sidebar tokens, landing overlays, simulation panel, and authentication overlays were moved to the blue system. Green energy tokens were deliberately preserved.

```text
Test Files 3 passed (3)
Tests      6 passed (6)
```

The focused run included the palette contract plus the existing public-page and authentication-layout accessibility tests.

The final project gate passed:

```text
Lint        passed
Type-check  passed
Test Files  15 passed (15)
Tests       43 passed (43)
Build       passed (21 routes)
```

Coverage remained above the project threshold:

```text
Statements 95.83%
Branches   89.70%
Functions  96.15%
Lines      95.77%
```

## Visual verification

The running landing page and sign-in page were inspected at desktop width. The hero uses navy overlays with amber solar emphasis; the authentication experience uses a light-blue visual field and blue form actions. Healthy status indicators remain green, preserving their operational meaning.
