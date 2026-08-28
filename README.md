# sharkAttend

Mobile-first attendance system using Next.js, Supabase, GitHub and Vercel.

## Features
- Employee number + password login
- One clock-in and one clock-out per Asia/Taipei workday
- Database-authoritative timestamps
- Announcement feed
- Employee profile / logout
- Administrator workspace
- Employee creation and role management
- Granular admin permissions
- Administrator password reset
- Row Level Security for employee-owned attendance data
- Logo slot reserved for a future image/logo asset

## Security
Production employee passwords are never committed to this repository. Supabase service-role credentials must only be used in protected server-side environments and must never be exposed through `NEXT_PUBLIC_*` variables.
