# Release Gates

Production deploys must pass:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run audit:prod`
- Supabase local migration reset and RLS SQL checks

Run these locally before merging into the production branch; the repository has no GitHub Actions workflows (see "Checks before merging" in the README for the exact commands).

Use staging for every migration that changes RLS, privileged functions, auth, storage, or notification delivery behavior.
