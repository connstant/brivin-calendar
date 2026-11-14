# Our Week

A shared weekly planner for two: plans, chores, dinners, trips, repeating events,
to-do lists (General plus one each) and a four-list shopping list. One shared password; each device stays signed in.

- **Front end:** static files in `public/`, hosted on Vercel.
- **Data + login:** Supabase (Postgres, live updates, password login).
  Only the planner login can read or change anything; that's enforced by the database
  (row-level security in `supabase/setup.sql`), not by the page.

## One-time setup

### 1. Supabase (data + password)
1. Create a free project at supabase.com.
2. **Authentication → Users → Add user → Create new user.** Email: the same address as
   `loginEmail` in `public/config.js` and in `supabase/setup.sql` (currently `plan@brivin.com`). Password: the shared
   password you want. Tick **Auto Confirm User**.
3. **Authentication → Sign In / Providers → Email:** turn off **Allow new users to sign up**.
   (The database already refuses other logins; this keeps strangers from making accounts at all.)
4. **SQL Editor → New query:** paste `supabase/setup.sql` and press **Run**.
5. Copy the **Project URL** (`https://<project-ref>.supabase.co`) and the **anon public** key
   into `public/config.js`. Both are under **Project Settings → Data API / API Keys**
   (older dashboards: **Project Settings → API**), or the **Connect** button at the top.

### 2. Vercel (the website)
Deploy the folder with the Vercel CLI (`vercel deploy --prod`) or import it from a Git repo.
`vercel.json` sets the output folder to `public/` and adds security headers.

### 3. Reminders (optional): phone notifications
Notifications go out when something with a start time begins, plus any earlier reminders picked on
the item (15 min, 30 min, 1 hour, 1 day). They work on Android, desktop browsers, and iPhone (iOS 16.4+)
when Our Week is opened from its Home Screen icon. Nothing to publish in an app store.

1. **Make a key pair** on your computer: `npx web-push generate-vapid-keys`.
   Put the **Public Key** in `public/config.js` as `vapidPublicKey`. Keep the private key out of the repo.
2. **Rerun `supabase/setup.sql`** in the SQL Editor (adds the reminder tables; your data is untouched).
3. **Deploy the function** `supabase/functions/send-reminders` with **JWT verification off**. Either:
   - CLI: `supabase functions deploy send-reminders --no-verify-jwt --project-ref <project-ref>`, or
   - Dashboard: **Edge Functions → Deploy a new function → Via editor**, name it `send-reminders`, paste
     `index.ts` and `reminders.ts` as two files, deploy, then turn off **Verify JWT** in its settings.
4. **Edge Functions → Secrets:** add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` from step 1, and
   `VAPID_SUBJECT` = your site's address (e.g. `https://our-week.vercel.app`).
5. **SQL Editor:** run `supabase/reminders.sql`. It calls the function every minute.
6. Redeploy the site, then on each phone: **Reminders** (top of the page) → **Turn on** → **Send a test**.
   Each phone chooses whether it hears about everything or just one person's items (plus shared ones).

If the test says the service didn't answer, check the function's **Logs** in Supabase.
`supabase/reminders.sql` also lists queries to see recent runs.

## Using it
- Open the site, enter the password once per device. It stays signed in.
- On a phone: Share → **Add to Home Screen** to open it like an app (on iPhone, needed for reminders).
- **Week and Day views** show a timeline in 30-minute steps. Things with a start time sit on it; drag one to
  move it, or drag its bottom edge to change when it ends. Multi-day items, PTO and trips are in **All day**
  at the top; things without a time are in **Anytime** below. Click or drag on the timeline to add at a time.
- **Colors show the type:** plans blue, chores green, out of town red, dinners orange. The small dot on an item shows whose it is.
- **To-do lists:** General plus one per person. Ticked items sink to the bottom; *Remove completed* clears them.
- **Chores** on the calendar also show on the To-Do page (Both → General, otherwise that person's list). Tick one off there,
  or open it on the calendar and press **Mark as done**. A repeating chore lists its current or next time (and the last one if missed).
  *Remove completed* takes finished chores off the list; they stay on the calendar.
- **On a phone, press and hold** an item to move it; a quick swipe just scrolls.
- **On a phone** the page splits into three tabs at the bottom: **To-Do** (opens first), **Calendar** and **Shopping**.
  Wider screens show everything on one page.
- **Sign out** (top right) → *Sign out all devices* if a phone is lost.
- To change the password: Supabase → Authentication → Users → the planner login →
  ⋯ → change password, then use *Sign out all devices*. (The login has no real inbox, so
  "send reset email" won't arrive; change it from the dashboard instead.)

## Notes
- The Supabase free tier pauses a project after about a week with no use. If the site
  says it can't reach the planner, open the Supabase dashboard and press **Restore project**.
- `config.js` values are meant to be public; the anon key can't read anything without the password.
  The same goes for `vapidPublicKey`; only the private key (a Supabase secret) must stay hidden.
- Reminders can't go out while the Supabase project is paused (see above).
