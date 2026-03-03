# Creating Premium Frontends Design

**Goal:** Create a reusable Codex skill for generating more distinctive, professional, production-grade frontend interfaces.

## Scope

- Focus on generation, not code review.
- Stay stack-agnostic.
- Prefer React-friendly guidance when the task is in React, without making React mandatory.

## Structure

- Create a new skill folder at `C:\Users\yannb\.codex\skills\creating-premium-frontends`.
- Keep `SKILL.md` concise and workflow-oriented.
- Move detailed design guidance into `references/design-principles.md` to preserve context efficiency.

## Behavior

The skill should guide the agent to:

1. Understand the product context, audience, and constraints.
2. Choose a clear aesthetic direction before writing code.
3. Translate that direction into concrete typography, color, layout, motion, and interaction decisions.
4. Produce working UI code with strong polish and practical UX quality.
5. Run a final pass for essential accessibility, semantics, focus visibility, and copy quality.

## Source Material

- Use the Vercel-style interface rules as creation-time quality constraints rather than an audit checklist.
- Use the frontend design document as the primary source for aesthetic ambition, differentiation, and anti-generic design direction.

## Design Choice

Use a lean skill with one reference file. Avoid templates or heavy assets for now to keep the skill broadly reusable and maintainable.
