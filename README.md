# Our Week

A shared weekly planner for two: plans, chores, dinners, PTO, trips, repeating events
and a four-list shopping list. One shared password; each device stays signed in.

- **Front end:** static files in `public/`, hosted on Vercel.
- **Data + login:** Supabase (Postgres, live updates, password login).
  Only the planner login can read or change anything; that's enforced by the database
  (row-level security in `supabase/setup.sql`), not by the page.

## One-time setup

### 1. Supabase (data + password)
1. Create a free project at supabase.com.
2. **Authentication → Users → Add user → Create new user.** Email: `planner@example.com`
   (a stand-in login name, so no real email is published in `config.js`). Password: the shared
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

## Using it
- Open the site, enter the password once per device. It stays signed in.
- On a phone: Share → **Add to Home Screen** to open it like an app.
- **Sign out** (top right) → *Sign out all devices* if a phone is lost.
- To change the password: Supabase → Authentication → Users → planner@example.com →
  ⋯ → change password, then use *Sign out all devices*. (The login has no real inbox, so
  "send reset email" won't arrive; change it from the dashboard instead.)

## Notes
- The Supabase free tier pauses a project after about a week with no use. If the site
  says it can't reach the planner, open the Supabase dashboard and press **Restore project**.
- `config.js` values are meant to be public; the anon key can't read anything without the password.
