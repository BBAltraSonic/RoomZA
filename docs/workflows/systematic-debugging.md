---
description: Four-phase debugging framework - use for ANY bug, test failure, or unexpected behavior before proposing fixes
---

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully** - Read stack traces completely, note line numbers, file paths, error codes
2. **Reproduce Consistently** - Can you trigger it reliably? If not reproducible → gather more data, don't guess
3. **Check Recent Changes** - Git diff, recent commits, new dependencies, config changes
4. **Gather Evidence in Multi-Component Systems** - Log what enters/exits each component boundary. Run once to gather evidence WHERE it breaks, THEN investigate that component.
5. **Trace Data Flow** - Use `/root-cause-tracing` workflow when error is deep in call stack

### Phase 2: Pattern Analysis

1. **Find Working Examples** - Similar working code in same codebase
2. **Compare Against References** - Read reference implementation COMPLETELY
3. **Identify Differences** - List every difference between working and broken
4. **Understand Dependencies** - What components, settings, config does this need?

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** - "I think X is the root cause because Y"
2. **Test Minimally** - SMALLEST possible change, one variable at a time
3. **Verify Before Continuing** - Worked? → Phase 4. Didn't work? → NEW hypothesis (don't pile fixes)

### Phase 4: Implementation

1. **Create Failing Test Case** - Simplest possible reproduction, MUST have before fixing
2. **Implement Single Fix** - ONE change at a time, no bundled refactoring
3. **Verify Fix** - Test passes? No other tests broken? Issue resolved?
4. **If Fix Doesn't Work** - If < 3 attempts: return to Phase 1. **If ≥ 3: STOP and question the architecture.**

## Red Flags - STOP and Follow Process

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X"
- "I don't fully understand but this might work"
- "One more fix attempt" (after 2+ failures)

**ALL mean: STOP. Return to Phase 1.**

## Integration with Other Workflows

- `/root-cause-tracing` - When error is deep in call stack
- `/defense-in-depth` - Add validation at multiple layers after finding root cause
- `/verification-before-completion` - Verify fix worked before claiming success
