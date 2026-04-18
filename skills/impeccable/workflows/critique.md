# Critique Workflow

Use this workflow when the user wants design feedback, UX review, or a direct answer to "what feels off here?"

This is not a code-style lint pass. It is a design-direction review grounded in user impact.

## Inputs

Before critiquing, confirm:

- what the interface is trying to accomplish,
- who it serves,
- what success looks like,
- and whether the user wants broad feedback or feedback on a specific area.

## Review Lenses

Evaluate the interface through these lenses:

1. Anti-pattern verdict
   - Does it immediately feel AI-generated?
   - Are there obvious Impeccable "don't" violations?
2. Visual hierarchy
   - Is the primary action obvious?
   - Is attention flowing to the right places?
3. Information architecture
   - Is the structure understandable?
   - Is the interface over-explaining or over-grouping?
4. Emotional resonance
   - Does the tone fit the audience and moment?
5. Cognitive load
   - Use `references/critique-cognitive-load.md`
6. Heuristics
   - Use `references/critique-heuristics-scoring.md`
7. Persona red flags
   - Use `references/critique-personas.md`

## Optional Detector Support

If the upstream `impeccable` CLI is actually available, detector findings can support the critique.

Treat detector results as evidence, not authority.
Call out false positives when necessary.

## Output Structure

Return a concise but sharp report with:

- anti-pattern verdict,
- overall impression,
- what is working,
- priority issues ordered by impact,
- heuristics score summary,
- persona red flags,
- minor observations,
- a recommended next pass such as craft, audit, or polish.

## Tone

Be honest, specific, and concrete.
Do not soften feedback into vague "could maybe explore" language.
Name the issue, explain why it matters, and say what a better direction would look like.
