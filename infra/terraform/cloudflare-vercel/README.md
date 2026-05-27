# RoomZA Cloudflare and Vercel Terraform

This directory is the production IaC starting point. It intentionally manages only the stable perimeter first: Cloudflare DNS/WAF rules and Vercel project/environment wiring.

Before applying:

- Create remote Terraform state.
- Set provider credentials through the CI/CD secret manager.
- Import any existing Cloudflare zone and Vercel project instead of recreating them.
- Apply to staging before production.
