# Environment Strategy

RoomZA uses four environments:

- Local: developer machine with `.env.local` and local Supabase.
- Development: shared non-production Vercel/Supabase project for integration work.
- Staging: production-like data shape, no real user documents, release candidate validation.
- Production: real user data, POPIA controls, monitored alerts, restricted admin access.

Never reuse production secrets outside production. Rotate credentials immediately if copied into a lower environment.

Server-only secrets must not use the `NEXT_PUBLIC_` prefix. Browser-exposed values must be listed in `.env.example`.
