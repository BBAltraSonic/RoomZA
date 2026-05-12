---
description: Improve interface resilience through better error handling, i18n support, text overflow handling, and edge case management
---

Strengthen interfaces against edge cases, errors, internationalization issues, and real-world usage scenarios.

## Assess Hardening Needs

1. **Test with extreme inputs**: Very long text, very short text, special characters (emoji, RTL, accents), large numbers, many items (1000+), no data
2. **Test error scenarios**: Network failures, API errors (400-500), validation errors, permission errors, rate limiting, concurrent operations
3. **Test internationalization**: Long translations (German +30%), RTL languages, CJK characters, date/time/number formats, currency symbols

**CRITICAL**: Designs that only work with perfect data aren't production-ready.

## Hardening Dimensions

### Text Overflow & Wrapping
- Single line truncation with ellipsis
- Multi-line clamp
- Word wrap with `overflow-wrap: break-word`
- Flex/Grid items: `min-width: 0` to allow shrinking
- Fluid typography with `clamp()`

### Internationalization (i18n)
- Add 30-40% space budget for translations
- Use flexbox/grid that adapts to content
- Use CSS logical properties for RTL (`margin-inline-start` not `margin-left`)
- Use `Intl` API for date/number/currency formatting
- Handle proper pluralization

### Error Handling
- **Network errors**: Clear messages, retry button, explain what happened
- **Form validation**: Inline errors, specific messages, preserve user input
- **API errors**: Handle each status code appropriately (400→validation, 401→login, 403→permission, 404→not found, 500→generic+support)
- **Graceful degradation**: Core functionality works without JS, progressive enhancement

### Edge Cases & Boundary Conditions
- **Empty states**: Clear next action, helpful messaging
- **Loading states**: Show what's loading, time estimates for long operations
- **Large datasets**: Pagination or virtual scrolling
- **Concurrent operations**: Prevent double-submission, handle race conditions
- **Permission states**: Clear explanation of restrictions

### Input Validation & Sanitization
- Client-side: Required fields, format validation, length limits
- Server-side: Always validate (never trust client only), sanitize, rate limit

### Accessibility Resilience
- Keyboard navigation: All functionality, logical tab order, focus management
- Screen reader: Proper ARIA labels, announce dynamic changes
- Motion sensitivity: Respect `prefers-reduced-motion`
- High contrast mode support

### Performance Resilience
- Slow connections: Progressive image loading, skeleton screens, optimistic UI
- Memory leaks: Clean up listeners, cancel subscriptions, abort pending requests
- Debounce search, throttle scroll handlers

**NEVER**:
- Assume perfect input
- Ignore internationalization
- Leave error messages generic
- Trust client-side validation alone
- Use fixed widths for text
- Block entire interface when one component errors

## Verify Hardening

Test with: 100+ character names, emoji in all fields, RTL text, disabled network, 1000+ items, rapid clicking, forced API errors, empty data.
