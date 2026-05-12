---
description: Autonomous recursive loop of Planning, Implementation, Review, and Verification for end-to-end task execution
---

# Godmode: The Recursive Development Loop

**Core Principle:** Plan once, execute iteratively, verify continuously.

## Phase 1: Planning

1. **Analyze Request**: Understand the goal.
2. **Generate Plan**: Use `/writing-plans` workflow to create a detailed, task-based implementation plan.
3. **Save Plan**: `docs/plans/YYYY-MM-DD-<feature>.md`.
4. **User Approval**: Confirm the plan with the user before proceeding.

## Phase 2: Execution & Review Cycle

For each task in the plan:

1. **Context Loading**: Read the task details and relevant files.
2. **Implementation**:
   - Write the test (TDD).
   - Implement the code.
   - Verify locally (run tests).
3. **Code Review**:
   - **MANDATORY**: Use `/requesting-code-review` workflow.
   - Check against plan requirements.
4. **Feedback Loop**:
   - If **Issues Found**: Fix them immediately → Re-review.
   - If **Clean**: Commit and mark task complete.
   - If implementation reveals the plan is invalid: **Re-plan** (return to Phase 1).

## Phase 3: Final Verification

1. **Full Suite Run**: Run all project tests.
2. **Integration Check**: Verify the feature works in the full application context.
3. **Evidence**: Collect logs/screenshots/output as proof.
4. **Completion**: Only declare success when evidence proves it.

## Safety Protocols

- **Never skip Review**: Even for "small" changes.
- **Evidence over Assertions**: Don't say "it works", show the test output.
- **Stop on Ambiguity**: If the plan is unclear, ask the user.

## How to Use

Announce: "I am engaging Godmode to implement [Feature Name]."
Then, immediately trigger Phase 1 (Planning).
