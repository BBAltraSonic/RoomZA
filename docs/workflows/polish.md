---
description: Final quality pass before shipping - fixes alignment, spacing, consistency, and detail issues
---

Perform a meticulous final pass to catch all the small details that separate good work from great work.

**CRITICAL**: Polish is the last step, not the first. Don't polish work that's not functionally complete.

## Polish Systematically

### Visual Alignment & Spacing
- Pixel-perfect alignment to grid
- Consistent spacing using spacing scale
- Optical alignment adjustments
- Responsive consistency at all breakpoints

### Typography Refinement
- Hierarchy consistency (same elements use same sizes/weights)
- Line length: 45-75 characters for body text
- No widows & orphans
- No FOUT/FOIT font loading flashes

### Color & Contrast
- All text meets WCAG standards
- Consistent token usage (no hard-coded colors)
- Tinted neutrals (no pure gray or pure black)
- Never put gray text on colored backgrounds

### Interaction States
Every interactive element needs: Default, Hover, Focus, Active, Disabled, Loading, Error, Success states.

### Micro-interactions & Transitions
- All state changes animated (150-300ms)
- Consistent easing: ease-out-quart/quint/expo (never bounce or elastic)
- 60fps animations, only animate transform and opacity
- Respects `prefers-reduced-motion`

### Content & Copy
- Consistent terminology and capitalization
- No typos, appropriate length
- Consistent punctuation

### Icons & Images
- Consistent icon style and sizing
- Proper alignment with adjacent text
- All images have alt text
- No layout shift on load

### Edge Cases & Error States
- All async actions have loading feedback
- Helpful empty states
- Clear error messages with recovery paths
- Handles very long content gracefully

### Responsiveness
- All breakpoints tested
- Touch targets: 44x44px minimum
- No horizontal scroll
- No text smaller than 14px on mobile

## Polish Checklist

- [ ] Visual alignment perfect at all breakpoints
- [ ] Spacing uses design tokens consistently
- [ ] Typography hierarchy consistent
- [ ] All interactive states implemented
- [ ] All transitions smooth (60fps)
- [ ] Copy is consistent and polished
- [ ] Icons consistent and properly sized
- [ ] All forms properly labeled and validated
- [ ] Error/loading/empty states handled
- [ ] Touch targets 44x44px minimum
- [ ] Contrast ratios meet WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] No console errors or layout shift
- [ ] Respects reduced motion preference
- [ ] Code is clean (no TODOs, console.logs)

**NEVER**:
- Polish before functionally complete
- Introduce bugs while polishing
- Perfect one thing while leaving others rough
