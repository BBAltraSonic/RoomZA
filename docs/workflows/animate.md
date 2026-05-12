---
description: Review a feature and enhance it with purposeful animations, micro-interactions, and motion effects
---

Analyze a feature and strategically add animations and micro-interactions that enhance understanding, provide feedback, and create delight.

## MANDATORY PREPARATION

### Context Gathering (Do This First)

Gather target audience, desired use-cases, brand personality/tone (playful vs serious), and performance constraints from the current thread or codebase.

If you can't fully infer context, ask the user directly before proceeding.

Do NOT proceed until you have answers. Guessing leads to inappropriate or excessive animation.

---

## Assess Animation Opportunities

Analyze where motion would improve the experience:

1. **Identify static areas**:
   - **Missing feedback**: Actions without visual acknowledgment
   - **Jarring transitions**: Instant state changes that feel abrupt
   - **Unclear relationships**: Spatial or hierarchical relationships not obvious
   - **Lack of delight**: Functional but joyless interactions

2. **Understand the context**:
   - What's the personality? (Playful vs serious, energetic vs calm)
   - What's the performance budget? (Mobile-first? Complex page?)
   - Who's the audience?

**CRITICAL**: Respect `prefers-reduced-motion`. Always provide non-animated alternatives.

## Plan Animation Strategy

- **Hero moment**: What's the ONE signature animation?
- **Feedback layer**: Which interactions need acknowledgment?
- **Transition layer**: Which state changes need smoothing?
- **Delight layer**: Where can we surprise and delight?

**IMPORTANT**: One well-orchestrated experience beats scattered animations everywhere.

## Implement Animations

### Entrance Animations
- **Page load choreography**: Stagger element reveals (100-150ms delays)
- **Hero section**: Dramatic entrance for primary content
- **Content reveals**: Scroll-triggered animations using intersection observer

### Micro-interactions
- **Button feedback**: Hover scale (1.02-1.05), click scale down then up
- **Form interactions**: Input focus transitions, validation animations
- **Toggle switches**: Smooth slide + color transition (200-300ms)

### State Transitions
- **Show/hide**: Fade + slide (200-300ms)
- **Loading states**: Skeleton screen fades, spinner animations
- **Success/error**: Color transitions, icon animations

### Technical Implementation

**Durations by purpose:**
- **100-150ms**: Instant feedback (button press, toggle)
- **200-300ms**: State changes (hover, menu open)
- **300-500ms**: Layout changes (accordion, modal)
- **500-800ms**: Entrance animations (page load)

**Easing curves (use these, not CSS defaults):**
- `ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1)` - Smooth, refined
- `ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` - Confident, decisive

**NEVER**:
- Use bounce or elastic easing curves
- Animate layout properties (width, height, top, left) - use transform instead
- Use durations over 500ms for feedback
- Animate without purpose
- Ignore `prefers-reduced-motion`

## Verify Quality

- **Smooth at 60fps**: No jank on target devices
- **Feels natural**: Easing curves feel organic
- **Appropriate timing**: Not too fast or too slow
- **Reduced motion works**: Animations disabled appropriately
- **Adds value**: Makes interface clearer or more delightful
