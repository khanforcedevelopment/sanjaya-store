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
3. **Sign-in settings** (Supabase → Authentication):
   - URL Configuration: Site URL `https://sanjayatrading.store`; add redirect URL `https://sanjayatrading.store/**`.
   - Email Templates → "Magic Link" and "Confirm signup": paste `supabase/templates/magic_link.html` and `confirmation.html` so emails show a 6-digit code (the site signs in with codes, not links).
   - SMTP Settings: connect Resend or Postmark. Supabase's built-in mailer only sends a few emails per hour and is not for real customers.
   - Phone provider: enable only after MSG91/Twilio and DLT registration (see USER_TODO). Until then the site still offers mobile login, but the code will not be sent; switch it on before launch or ask the developer to hide the Mobile tab.
4. Copy the **Project URL** and **anon public key** from Supabase → Project Settings → API into the website's public settings, then rebuild and redeploy the website.

## E. Stripe setup (Phase 9)

The website never sees a Stripe secret. Three server functions run on Supabase: `create-checkout` (opens Stripe's payment page), `stripe-webhook` (Stripe tells us a payment succeeded, expired or was refunded) and `admin-refund` (Super Admin refunds).

1. Stripe dashboard → switch on **Test mode**. Developers → API keys: note the **test secret key** (`sk_test_…`).
2. Deploy the functions (developer): `supabase functions deploy create-checkout stripe-webhook admin-refund`.
3. Stripe → Developers → Webhooks → **Add endpoint**: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`, with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`. Copy the **signing secret** (`whsec_…`).
4. Store the secrets on Supabase (Supabase → Edge Functions → Secrets, or `supabase secrets set`):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL=https://sanjayatrading.store`, `ALLOWED_ORIGINS=https://sanjayatrading.store`. Never paste them into the website, an email or a chat.
5. Test with card `4242 4242 4242 4242`, any future date, any CVC. The order should move to "Awaiting approval" within seconds.
6. **Live mode stays blocked by the code**: with an `sk_live_` key, payments are refused until the Super Admin switches on *Settings → Payments → Live payments*. Do this only after Stripe confirms in writing that the UAE account may sell to Indian customers, and after the owner's final approval.

## E2. Identity checks and mobile verification (Phase 16)

1. Deploy the function: `supabase functions deploy kyc-submit`.
2. Set one more secret: `KYC_HASH_SALT` = a long random value (for example the output of `openssl rand -hex 32`). It turns ID numbers into fingerprints for duplicate detection. **Never change it after launch**, or duplicates can no longer be detected. Do not share it.
3. Supabase → Authentication → Sign In / Providers → **Phone**: turn on **Confirm phone** so a mobile number counts as verified only after the SMS code. Connect an SMS provider (USER_TODO, paid). Until then customers cannot verify a mobile number, so they cannot use installments.
4. The `kyc-documents` storage bucket is private. Customers can upload only into their own folder and cannot read files back; only the Super Admin can view them (Admin → Identity checks).

## E3. Email notifications, sitemap and app install (Phase 19)

1. Deploy: `supabase functions deploy dispatch-notifications sitemap`.
2. **Email**: create a Resend account (free tier: 3,000 emails a month), verify the domain `sanjayatrading.store` (Resend shows the DNS records to add at your domain provider), create an API key, then set Supabase secrets `RESEND_API_KEY` and `EMAIL_FROM` (for example `Sanjaya Store <orders@sanjayatrading.store>`). Without these, nothing is sent and updates wait in the queue.
3. **Schedule** sending: Supabase → Integrations → Cron → New job → type *Supabase Edge Function*, function `dispatch-notifications`, method POST, every 5 minutes (`*/5 * * * *`). Updates older than 2 days are skipped, so switching email on later does not flood customers.
4. **Sitemap**: when the site is built with `VITE_SUPABASE_URL` set to the live project, `/sitemap.xml` is forwarded to the `sitemap` function automatically. Submit `https://sanjayatrading.store/sitemap.xml` in Google Search Console.
5. **App install**: nothing to set up. The site has a web app manifest, icons and an offline page; Chrome on Android offers "Install app", iPhone users use Share → Add to Home Screen (see `/install`).
6. WhatsApp updates are queued too but are only sent once a WhatsApp Business provider is connected (USER_TODO).

## F. Connecting your domain (Phase 20, only with your approval)

The old produce website currently runs on sanjayatrading.store. The new site stays on its `.netlify.app` address until you approve the switch at launch. Then: Netlify → **Domain management → Add a domain**, and follow Netlify's DNS instructions at your domain registrar. Netlify issues the HTTPS certificate automatically.

## Where the old website went

The old fruits and vegetables site is preserved in GitHub history on the `main` branch before the Phase 1 merge (last commit `04552d0`, which can be restored from GitHub history at any time). It is not used by the new store.
