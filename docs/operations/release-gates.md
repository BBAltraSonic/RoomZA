# Release Gates

Production deploys must pass:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run audit:prod`
- Supabase local migration reset and RLS SQL checks

Branch protection should require the GitHub Actions `App checks` and `Supabase RLS checks` jobs before merging into the production branch.

Use staging for every migration that changes RLS, privileged functions, auth, storage, or notification delivery behavior.
