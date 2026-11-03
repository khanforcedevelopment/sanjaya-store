# Sanjaya Store: Deployment Guide

Written for a non-technical owner. Developer steps are marked **(developer)**.

## What gets deployed where

The store has two halves that are deployed separately:

| Part | Where it lives | Can it be deployed by Netlify drag and drop? |
|---|---|---|
| Website files (everything customers and staff see) | Netlify | **Yes.** Drag the `dist` folder. |
| Database, logins, product images | Supabase | **No.** Set up once in Supabase. |
| Server code: Stripe payments and webhooks, order approval, delivery fees, KYC, reminders | Supabase Edge Functions | **No.** Deployed by a developer with the Supabase command-line tool. |
| Payment settings and webhook | Stripe dashboard | **No.** Configured in Stripe. |

Uploading the website alone does **not** create the database, logins, webhooks or server code. Until the Supabase part is set up, the website shows pages but cannot take orders.

You redeploy the website by drag and drop every time the design or features change. The Supabase part only needs redeploying when a phase changes the database or server code, and each phase report will tell you if it did.

## Phase 1 status

Right now only the website shell exists. It builds, and you can drag-and-drop it to see the placeholder page. There is no database or payment yet, so there is nothing to deploy on Supabase or Stripe.

## A. Build the website folder **(developer, or anyone with Node.js installed)**

1. Install Node.js 22 LTS from nodejs.org.
2. Open a terminal in the project folder and run:
   ```
   npm ci
   npm run build
   ```
3. A folder named `dist` appears. The build checks itself: it stops with an error if a secret key ever ends up inside `dist`.

Website settings (public only) go in a file named `.env.production` next to `package.json` before building. Copy `.env.example` for the list. **Never** put a Stripe secret key (`sk_...`) or Supabase service_role key there; the build will refuse.

## B. Deploy the website to Netlify by drag and drop

1. Go to https://app.netlify.com and log in (or sign up free).
2. First time: open **Sites**, scroll to the box that says **"Drag and drop your site output folder here"**, and drag the `dist` folder onto it. Drag the folder itself, not a zip of the project, and not the whole project folder.
3. Netlify gives you an address like `random-name.netlify.app`. Open it to check the site.
4. To rename it: **Site configuration → Change site name** (e.g. `sanjaya-store.netlify.app`).
5. To update later: open the site in Netlify → **Deploys** tab → drag the new `dist` folder onto the box at the bottom of that page. The old version stays in the list and can be restored with **Publish deploy** if something goes wrong.

The `dist` folder already contains `_redirects` (so links like `/p/product-name` work when opened directly) and `_headers` (security settings). Do not delete them.

## C. Optional: automatic deploys from GitHub

Instead of drag and drop, Netlify can rebuild the site every time code is merged on GitHub: **Add new site → Import an existing project → GitHub → khanforcedevelopment/sanjaya-store**. The included `netlify.toml` tells Netlify how to build. Public settings then go in **Site configuration → Environment variables**. Either method works; you can switch at any time.

## D. Supabase setup (from Phase 2) **(developer, one time)**

1. Create a project at https://supabase.com, region **South Asia (Mumbai)**. Save the database password in a password manager.
2. Install the Supabase CLI, then:
   ```
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push                 # creates the tables and security rules
   supabase functions deploy        # deploys the server code
   supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Copy the **Project URL** and **anon public key** from Supabase → Project Settings → API into the website's public settings, then rebuild and redeploy the website.

## E. Stripe setup (Phase 9)

1. Use **test mode** first (toggle in the Stripe dashboard).
2. Stripe → Developers → Webhooks → add endpoint: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`. Exact events will be listed in the Phase 9 report.
3. Give the secret key and webhook signing secret to the developer to store with `supabase secrets set`. Never paste them into the website, an email, or a chat.
4. Live mode is switched on only after Stripe confirms the UAE account may sell to India, and after your final approval.

## F. Connecting your domain (Phase 20, only with your approval)

The old produce website currently runs on sanjayatrading.store. The new site stays on its `.netlify.app` address until you approve the switch at launch. Then: Netlify → **Domain management → Add a domain**, and follow Netlify's DNS instructions at your domain registrar. Netlify issues the HTTPS certificate automatically.

## Where the old website went

The old fruits and vegetables site is preserved in GitHub history on the `main` branch before the Phase 1 merge (tag `legacy-produce-site`). It is not used by the new store.
