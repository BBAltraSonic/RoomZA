---
description: Normalize design to match your design system and ensure consistency
---

Analyze and redesign the feature to perfectly match design system standards, aesthetics, and established patterns.

## Plan

1. **Discover the design system**: Search for design system documentation, UI guidelines, component libraries, or style guides. Study:
   - Core design principles and aesthetic direction
   - Target audience and personas
   - Component patterns and conventions
   - Design tokens (colors, typography, spacing)
   
   **CRITICAL**: If something isn't clear, ask. Don't guess at design system principles.

2. **Analyze the current feature**:
   - Where does it deviate from design system patterns?
   - Which inconsistencies are cosmetic vs. functional?
   - What's the root cause?

3. **Create a normalization plan**: Define specific changes:
   - Which components can be replaced with design system equivalents?
   - Which styles need to use design tokens?
   - How can UX patterns match established user flows?

## Execute

Systematically address all inconsistencies:

- **Typography**: Use design system fonts, sizes, weights, line heights
- **Color & Theme**: Apply design system color tokens
- **Spacing & Layout**: Use spacing tokens, align with grid systems
- **Components**: Replace custom implementations with design system components
- **Motion & Interaction**: Match animation timing, easing, interaction patterns
- **Responsive Behavior**: Ensure breakpoints align with design system standards
- **Accessibility**: Verify contrast ratios, focus states, ARIA labels

**NEVER**:
- Create new one-off components when design system equivalents exist
- Hard-code values that should use design tokens
- Introduce new patterns that diverge from design system
- Compromise accessibility for visual consistency

## Clean Up

- Consolidate reusable components into shared path
- Remove orphaned code
- Verify quality: lint, type-check, test
- Ensure DRYness
