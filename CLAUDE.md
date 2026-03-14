## Design Context

### Users

- Primary user is one person managing personal finances, mostly on Windows desktop and occasionally on mobile browser over LAN.
- Core jobs: log a transaction in under 10 seconds, review monthly cashflow, track card invoices, confirm recurring expenses, and close reimbursements.
- Usage context includes frequent context switching, so the interface must stay fast, scannable, and low-friction.

### Brand Personality

- 3-word personality: trustworthy, efficient, calm.
- Voice and tone: direct, practical, and data-first; feedback should be clear without sounding alarmist.
- Emotional goal: make financial control feel stable and confident, not stressful.
- Anti-reference: playful/gamified banking UI, visual noise, or decorative effects that compete with numbers.

### Aesthetic Direction

- Product shape: one shared React UI with two surfaces:
  - Desktop: denser workspace with sidebar navigation, rich overviews, and keyboard shortcuts.
  - Mobile LAN: essential views only, large touch targets, and persistent quick-add action.
- Visual system: modern financial dashboard language with subtle acrylic/mica layers, rounded cards, restrained gradients, and semantic status colors.
- Theme model: support light and dark mode, preserve semantic finance colors, and allow controlled primary-brand color customization.
- Typography: Geist Sans / Inter / Segoe stack with tabular numerals for money and KPI alignment.
- Motion: short, purposeful transitions that reinforce state change and never slow down capture/review flows.

### Design Principles

1. Speed over ceremony: optimize high-frequency flows to complete in under 10 seconds.
2. Numbers first: balances, totals, due dates, and status always lead visual hierarchy.
3. Semantic consistency: the same color and state language must map to the same meaning everywhere.
4. Dense but readable: maximize information on desktop while preserving legibility and tap/keyboard ergonomics.
5. Calm reliability: show immediate, explicit feedback and error recovery paths without creating anxiety.
