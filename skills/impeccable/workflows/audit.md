# Audit Workflow

Use this workflow when the user wants a technical quality review of a frontend surface.

This is implementation-focused rather than taste-focused.
It should stay read-only unless the user explicitly asks for fixes afterward.

## Audit Dimensions

Review these five dimensions:

1. Accessibility
   - contrast,
   - semantic structure,
   - focus states,
   - labels,
   - keyboard flow.
2. Performance
   - heavy layout work,
   - expensive animations,
   - obvious rendering waste,
   - asset or loading problems.
3. Theming
   - token usage,
   - hard-coded colors,
   - dark-mode or theme drift.
4. Responsive behavior
   - fixed widths,
   - small touch targets,
   - overflow,
   - text scaling failures.
5. Anti-patterns
   - generic AI tells,
   - repeated visual mistakes,
   - violations of the bundled Impeccable guidance.

## Optional Detector Support

If the upstream detector runtime is ready, use it as supporting evidence for anti-pattern findings.

Keep the scan scoped.
Prefer a small read-only smoke first:

```bash
impeccable detect --fast --json <target>
```

## Output Structure

Return:

- a dimension-by-dimension score summary,
- the anti-pattern verdict up front,
- prioritized findings with severity,
- systemic issues worth fixing once instead of everywhere,
- positive findings worth preserving,
- and the smallest reasonable next action.

## Severity Guidance

- `P0`: blocking or release-stopping
- `P1`: major problem that should be fixed before release
- `P2`: meaningful but not blocking
- `P3`: polish-level issue

Avoid flooding the report with low-value `P3` noise.
Prioritize what truly affects users.
