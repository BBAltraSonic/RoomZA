---
description: Perform comprehensive audit of interface quality across accessibility, performance, theming, and responsive design
---

Run systematic quality checks and generate a comprehensive audit report with prioritized issues and actionable recommendations. Don't fix issues - document them for other commands to address.

## Diagnostic Scan

Run comprehensive checks across multiple dimensions:

1. **Accessibility (A11y)** - Check for:
   - **Contrast issues**: Text contrast ratios < 4.5:1
   - **Missing ARIA**: Interactive elements without proper roles/labels
   - **Keyboard navigation**: Missing focus indicators, illogical tab order
   - **Semantic HTML**: Improper heading hierarchy, missing landmarks
   - **Form issues**: Inputs without labels, poor error messaging

2. **Performance** - Check for:
   - **Layout thrashing**: Reading/writing layout properties in loops
   - **Expensive animations**: Animating layout properties instead of transform/opacity
   - **Missing optimization**: Images without lazy loading
   - **Render performance**: Unnecessary re-renders

3. **Theming** - Check for:
   - **Hard-coded colors**: Colors not using design tokens
   - **Broken dark mode**: Missing dark mode variants
   - **Inconsistent tokens**: Using wrong tokens

4. **Responsive Design** - Check for:
   - **Fixed widths**: Hard-coded widths that break on mobile
   - **Touch targets**: Interactive elements < 44x44px
   - **Horizontal scroll**: Content overflow on narrow viewports

5. **Anti-Patterns (CRITICAL)** - Check for AI slop tells and general design anti-patterns.

**CRITICAL**: This is an audit, not a fix. Document issues thoroughly.

## Generate Comprehensive Report

### Anti-Patterns Verdict
Pass/fail: Does this look AI-generated? List specific tells. Be brutally honest.

### Executive Summary
- Total issues found (count by severity)
- Most critical issues (top 3-5)
- Recommended next steps

### Detailed Findings by Severity

For each issue document:
- **Location**: Where the issue occurs
- **Severity**: Critical / High / Medium / Low
- **Category**: Accessibility / Performance / Theming / Responsive
- **Description**: What the issue is
- **Impact**: How it affects users
- **Recommendation**: How to fix it

### Patterns & Systemic Issues
Identify recurring problems.

### Positive Findings
Note what's working well.

### Recommendations by Priority
1. **Immediate**: Critical blockers
2. **Short-term**: High-severity issues
3. **Medium-term**: Quality improvements
4. **Long-term**: Nice-to-haves

**NEVER**:
- Report issues without explaining impact
- Mix severity levels inconsistently
- Skip positive findings
- Provide generic recommendations
