---
description: Systematically trace bugs backward through call stack to find the original trigger
---

Bugs often manifest deep in the call stack. Your instinct is to fix where the error appears, but that's treating a symptom.

**Core principle:** Trace backward through the call chain until you find the original trigger, then fix at the source.

## When to Use

- Error happens deep in execution (not at entry point)
- Stack trace shows long call chain
- Unclear where invalid data originated
- Need to find which test/code triggers the problem

## The Tracing Process

### 1. Observe the Symptom
Note the exact error message and location.

### 2. Find Immediate Cause
What code directly causes this error?

### 3. Ask: What Called This?
Trace backward through the call chain. Map out the full call path.

### 4. Keep Tracing Up
What value was passed? Where did it come from? Keep going until you find the source.

### 5. Find Original Trigger
Where did the invalid data originate? This is where you fix.

## Adding Stack Traces

When you can't trace manually, add instrumentation:

```dart
// Before the problematic operation
debugPrint('DEBUG operation: directory=$directory, stack=${StackTrace.current}');
```

**Critical:** Use `debugPrint()` in Flutter (not logger - may not show in tests)

**Analyze stack traces:**
- Look for test file names
- Find the line number triggering the call
- Identify the pattern (same test? same parameter?)

## Key Principle

**NEVER fix just where the error appears.** Trace back to find the original trigger.

After finding root cause, also add defense-in-depth:
- Layer 1: Entry point validation
- Layer 2: Business logic validation
- Layer 3: Environment guards
- Layer 4: Stack trace logging

## Stack Trace Tips

- **In tests:** Use `debugPrint()` not logger
- **Before operation:** Log before the dangerous operation, not after it fails
- **Include context:** Directory, cwd, environment variables, timestamps
- **Capture stack:** `StackTrace.current` shows complete call chain
