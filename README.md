# sharkAttend

Mobile-first attendance MVP using Next.js, Supabase, GitHub and Vercel.

## Features
- Employee number + password login (internal synthetic email mapping)
- One clock-in and one clock-out per Asia/Taipei workday
- Database-authoritative timestamps
- Announcement feed
- Profile / logout
- RLS: employees can only read their own profile and attendance rows
- Logo slot reserved for a future image/logo asset

## Local setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the project SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL + publishable key.
4. Add the service role key temporarily and run `npm run seed:users` once.
5. Remove the service role key from local env if no longer needed.
6. `npm install && npm run dev`.

## Test users
- 001 / Penny / `Shark001!`
- 002 / Amy / `Shark002!`
- 003 / Angus / `Shark003!`

Change these test passwords before using the app for real staff.
