---
description: Review implementation against plan or requirements before proceeding
---

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After completing each major task
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

1. **Get git SHAs:**
```bash
git log --oneline -5  # Find relevant commits
```

2. **Review against requirements:**
- What was implemented
- What it should do (plan or requirements)
- Base and head commits
- Brief summary of changes

3. **Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Integration with Workflows

- **During plan execution:** Review after EACH task
- **Ad-hoc development:** Review before merge, review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
