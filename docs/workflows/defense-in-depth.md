---
description: Validate at every layer data passes through to make bugs structurally impossible
---

When you fix a bug caused by invalid data, adding validation at one place feels sufficient. But that single check can be bypassed by different code paths, refactoring, or mocks.

**Core principle:** Validate at EVERY layer data passes through. Make the bug structurally impossible.

## Why Multiple Layers

Single validation: "We fixed the bug"
Multiple layers: "We made the bug impossible"

## The Four Layers

### Layer 1: Entry Point Validation
**Purpose:** Reject obviously invalid input at API boundary.
Validate: not empty, exists, correct type, writable.

### Layer 2: Business Logic Validation
**Purpose:** Ensure data makes sense for this operation.
Each function validates its own preconditions independently.

### Layer 3: Environment Guards
**Purpose:** Prevent dangerous operations in specific contexts.
Example: Refuse destructive operations outside temp directories in tests.

### Layer 4: Debug Instrumentation
**Purpose:** Capture context for forensics.
Log directory, cwd, environment variables, stack traces before dangerous operations.

## Applying the Pattern

When you find a bug:

1. **Trace the data flow** - Where does bad value originate? Where is it used?
2. **Map all checkpoints** - List every point data passes through
3. **Add validation at each layer** - Entry, business, environment, debug
4. **Test each layer** - Try to bypass layer 1, verify layer 2 catches it

## Key Insight

All four layers are necessary. Different layers catch different cases:
- Different code paths bypass entry validation
- Mocks bypass business logic checks
- Edge cases on different platforms need environment guards
- Debug logging identifies structural misuse

**Don't stop at one validation point.** Add checks at every layer.
