# Polish Workflow

Use this workflow when the feature basically works but still feels rough, uneven, or not yet ship-ready.

Polish is a final-quality pass, not a substitute for unfinished product thinking.

## Before Polishing

Confirm:

- the feature is functionally complete enough to polish,
- the expected quality bar is clear,
- the existing design system or shared patterns are known,
- and the target states worth checking are visible.

## Polish Pass

Work through these dimensions methodically:

1. alignment and spacing,
2. typography consistency,
3. token and color consistency,
4. interactive states,
5. motion quality,
6. copy quality,
7. icons and imagery,
8. forms and validation,
9. edge cases and empty states,
10. responsive behavior,
11. obvious code cleanup that directly supports polish.

## Checks

Look for:

- spacing drift,
- visually off alignment,
- weak hierarchy,
- missing hover, focus, loading, error, or success states,
- contrast problems,
- awkward copy,
- leftover one-off values,
- and dead code created during iteration.

## Guardrails

- Do not introduce bugs while polishing.
- Do not create new one-off components when shared ones already exist.
- Do not spend flagship time on an MVP with a tiny release window unless the user asks for it.
- Do not hard-code values that should clearly be tokens.

## Done Means

The interface feels coherent, deliberate, and clean under real interaction, not just in a screenshot.
