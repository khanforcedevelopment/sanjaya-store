# Supabase backend

This folder is deployed separately from the website, with the Supabase CLI.
It is NOT deployed by dragging dist/ into Netlify.

- migrations/  SQL schema, Row Level Security policies, seed data (Phase 2)
- functions/   Edge Functions (server code): Stripe checkout and webhooks,
               order approval, delivery fee calculation, KYC callbacks (Phase 2 onward)

Secrets (Stripe secret key, webhook signing secret, KYC credentials) are set with
`supabase secrets set` and never committed. See DEPLOYMENT.md.
