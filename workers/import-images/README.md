# Private import-image transport

Cloudflare Workers validates every DNS answer and sends that exact address set to the existing project's free Supabase Edge Function, `import-image`. The function dials a literal address with `Deno.connect`, upgrades the same socket with `Deno.startTls` using the original hostname, and completes certificate validation before sending HTTP bytes. Redirects return to the application for a fresh URL/DNS check. Neither runtime falls back to an unpinned request.

The function requires gateway JWT verification and a constant-time match against `IMPORT_IMAGE_CALLER_SHA256`, the SHA-256 hash of the complete `Bearer <existing app service-role key>` header. Anonymous and ordinary user credentials cannot use the transport. The hash is configured as a Supabase secret; the app continues using its existing service credential and bindings. Rotate the hash together with that credential.

HTTP headers, framing, encoded/decoded image bytes, redirects and time are bounded. Each request owns and closes its socket, including cancellation and late connection completion. The service forwards only the transport marker, private/no-store policy, image bytes or a redirect Location. It does not log credentials or supplied URLs, write application data, or register images. The existing application command retains authorization, signature validation, Storage and registration.

Build with `node scripts/ops/build-import-image-function.mjs`. The manifest records the exact five source inputs and bundle hash. Upload its generated `index.ts` to the existing Supabase project with `verify_jwt: true`, then run hosted access/byte/certificate checks before deploying the app. There are no new npm dependencies, paid services or plan upgrades. Free-plan quotas still apply.

Retained runtime evidence and current limitations are tracked in `docs/user-flow-evidence-ledger-20261025.json`. A deployed transport function is not a deployment or acceptance of the main RoomZA application.
