# Extract Workflow

Use this workflow when repeated UI patterns should become reusable components or design tokens.

The goal is not to abstract everything. The goal is to extract what is clearly repeating with the same intent.

## Step 1: Discover the Existing System

Find the current design system, shared UI area, or component library.
Understand naming conventions, token structure, import conventions, and how shared UI is organized today.

If no design system exists, confirm the preferred direction before creating one.

## Step 2: Identify Real Extraction Candidates

Look for:

- repeated components used three or more times,
- hard-coded values that should be tokens,
- visually inconsistent versions of the same concept,
- repeated layout or composition patterns,
- repeated type styles,
- repeated motion patterns.

Do not extract one-offs or context-specific snowflakes.

## Step 3: Plan the Extraction

Decide:

- what becomes a shared component,
- what becomes a token,
- what variants are actually needed,
- how the names should fit the existing system,
- and how current usages will migrate.

## Step 4: Extract and Enrich

The shared version should be better than the repeated originals:

- clearer API,
- accessibility baked in,
- consistent token usage,
- sensible defaults,
- and better documentation.

## Step 5: Migrate and Clean Up

Replace old implementations systematically, verify parity, and delete dead code.

A good extraction reduces entropy.
If it creates more wrappers, more confusion, or more one-off exceptions, it was not ready to extract.
