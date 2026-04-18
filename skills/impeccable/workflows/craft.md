# Craft Workflow

Use this workflow for real implementation work after the design direction is clear.

The sequence matters: shape first, then load the minimum references, then build, then visually iterate until the result stops feeling generic.

## Step 1: Start From a Confirmed Brief

Begin with an explicit brief, whether the user already gave it or it was created through the shape workflow.

If the brief is still fuzzy, pause and shape first.

## Step 2: Load the Minimum Useful References

At minimum, consult:

- `references/spatial-design.md`
- `references/typography.md`

Then add only what the task needs:

- interaction-heavy flows:
  `references/interaction-design.md`
- motion or transitions:
  `references/motion-design.md`
- color-heavy or themed interfaces:
  `references/color-and-contrast.md`
- responsive complexity:
  `references/responsive-design.md`
- label, copy, error, or empty-state work:
  `references/ux-writing.md`

## Step 3: Build in a Deliberate Order

Implement in this order:

1. semantic structure,
2. layout and spacing rhythm,
3. typography and color system,
4. interaction states,
5. edge-case states,
6. motion,
7. responsive adaptation.

Use realistic content early.
Do not leave empty, loading, or error states as an afterthought.

## Step 4: Run the AI-Slop Test

Before calling the work good, ask:

- does this look like a stock AI-generated layout,
- did the design rely on default fonts or default color reflexes,
- is there too much card nesting, weak hierarchy, or decorative noise,
- does the result actually match the brief's tone and audience.

If the answer is yes, iterate again.

## Step 5: Visually Iterate

Inspect the real result, not just the code.

Check:

- hierarchy,
- spacing rhythm,
- contrast,
- responsive adaptation,
- all key states,
- and the emotional feel of the interface.

The stopping condition is not "it works."
The stopping condition is "this feels intentional, specific, and ready to show."
