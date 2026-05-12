---
description: Extract and consolidate reusable components, design tokens, and patterns into your design system
---

Identify reusable patterns, components, and design tokens, then extract and consolidate them into the design system for systematic reuse.

## Discover

1. **Find the design system**: Locate your design system, component library, or shared UI directory. Understand its structure:
   - Component organization and naming conventions
   - Design token structure (if any)
   - Import/export conventions
   
   **CRITICAL**: If no design system exists, ask before creating one.

2. **Identify patterns**: Look for:
   - **Repeated components**: Similar UI patterns used multiple times
   - **Hard-coded values**: Colors, spacing, typography that should be tokens
   - **Inconsistent variations**: Multiple implementations of the same concept
   - **Reusable patterns**: Layout, composition, interaction patterns worth systematizing

3. **Assess value**: Not everything should be extracted:
   - Is this used 3+ times, or likely to be reused?
   - Would systematizing this improve consistency?
   - What's the maintenance cost vs benefit?

## Plan Extraction

- **Components to extract**: Which UI elements become reusable?
- **Tokens to create**: Which hard-coded values become design tokens?
- **Variants to support**: What variations does each component need?
- **Naming conventions**: Match existing patterns
- **Migration path**: How to refactor existing uses

**IMPORTANT**: Extract what's clearly reusable now, not everything that might someday be reusable.

## Extract & Enrich

- **Components**: Clear props API, proper variants, accessibility built in, documentation
- **Design tokens**: Clear naming (primitive vs semantic), proper hierarchy
- **Patterns**: When to use, code examples, variations

**NEVER**:
- Extract one-off, context-specific implementations without generalization
- Create components so generic they're useless
- Skip proper TypeScript types or prop documentation
- Create tokens for every single value

## Migrate

- Find all instances of extracted patterns
- Replace systematically with shared versions
- Test thoroughly for visual and functional parity
- Delete old implementations

## Document

- Add new components to component library
- Document token usage and values
- Add examples and guidelines
