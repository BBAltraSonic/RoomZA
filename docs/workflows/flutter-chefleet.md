---
description: Chefleet-specific Flutter guidance for BLoC, Clean Architecture, Supabase, MD3, and role-based navigation
---

# Chefleet Flutter Development Guide

Chefleet is a mobile marketplace enabling township-based home chefs to publish menus and sell food locally.

## Core Technologies
- **Flutter 3.x** — Dart, material theming, high-performance UI
- **BLoC (flutter_bloc)** — Deterministic state management
- **Supabase** — PostgreSQL, Auth, Storage, Realtime, RLS security
- **go_router** — Modular, role-driven routing
- **Material Design 3** — Combined with custom Glass UI aesthetic
- **google_maps_flutter** — Location-aware food discovery

## Architecture

```
lib/
├── core/          # App-wide: constants, errors, services, theme, utils, global_blocs
├── shared/        # Reusable widgets, components, shared_blocs
└── features/      # auth, customer, vendor, cart, orders, settings
```

## BLoC Pattern Rules
- Events are command-driven (user/system intent)
- States are declarative snapshots of the UI/logic
- UI contains zero business logic
- Use `bloc_test` and `mocktail` for testing

## Role Switching Logic
- Users may act as Customer or Vendor seamlessly
- RoleBloc resolves current active role, persistence, navigation trees
- go_router provides CustomerShellRoute and VendorShellRoute
- All role transitions must maintain authenticated session, refresh profile state, reset feature-specific BLoCs

## Database / Supabase Standards
- Use column names exactly as in DATABASE_SCHEMA.md
- Apply strict RLS policies: no request bypasses policy checks
- Include `auth.uid()` in filters where required
- Common mistakes: `pickup_time` vs `estimated_fulfillment_time`

## UI/UX Guidelines
- **Font**: Plus Jakarta Sans
- **Primary**: #00A86B
- **Background**: #F7FAFC
- **Glass UI**: Blur 18dp containers, 12dp bottom bars, 0.8 opacity
- **Tap targets**: ≥ 48x48dp
- **Animations**: <300ms
- **WCAG AA** contrast compliance

## Performance Metrics
- Cold launch < 3 sec
- Navigation transitions < 300ms
- Scrolling ≥ 55fps

## Adding a New Feature
1. Create folder in `lib/features/<feature_name>/`
2. Add BLoC, events, states
3. Add repository + data models (if new data flow)
4. Build screens + widgets
5. Add route entries to router config
6. Write bloc tests + widget tests
7. Update documentation

## Testing Standards
- BLoC → `bloc_test`, Service logic → pure Dart tests
- Widget testing with `pumpWidget` + MaterialApp + Provider setup
- Golden tests for critical UI
- 70%+ coverage target
- All critical paths tested (auth, role switch, checkout, vendor menu)
