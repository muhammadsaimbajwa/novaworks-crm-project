# NovaWorks AI Project Manager

**THE INFINITY HACK '26 — AI Project Manager: Meeting to Execution**

An AI-powered project management CRM for the fictional **NovaWorks Technologies** (Lahore, Pakistan). An admin pastes a meeting transcript; an LLM turns the final decisions into projects and tasks, assigns them to existing managers and developers, and saves everything. Every user then sees only the projects and tasks they are authorized to see.

```
Admin logs in → pastes transcript → AI extracts projects/tasks → validated → saved atomically → role-based views
```

## Features

- Cookie-session login and logout (signed, httpOnly cookie that stores only the user id)
- Role-based access control (ADMIN / MANAGER / AGENT) enforced on the server
- **Create from Transcript** (admin only): real LLM extraction, strict validation, all-or-nothing save
- Dashboard, project list, project detail, My Tasks, read-only team directory
- Loading, empty, error and success states; responsive sidebar layout

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma · PostgreSQL (Supabase-compatible) · Zod · jose (JWT cookie) · bcryptjs · Anthropic Messages API

## Architecture

```
app/
  login/                    sign-in page
  (app)/                    authenticated shell (sidebar layout)
    dashboard/ projects/ projects/[id]/ tasks/ team/ admin/transcript/
  api/
    auth/login, auth/logout
    projects, projects/[id], tasks
    ai/transcript           admin-only AI pipeline
components/                 Sidebar, ProjectCard, TaskRow, TranscriptForm, ...
lib/
  db.ts                     Prisma client
  auth.ts                   session cookie + getCurrentUser()
  permissions.ts            getProjectsForUser / getProjectForUser / getTasksForUser
  validation.ts             Zod schemas + semantic validation of AI output
  ai.ts                     extractProjectsFromTranscript() — the only LLM-specific file
prisma/schema.prisma, prisma/seed.ts
middleware.ts               redirects unauthenticated page visits to /login
```

### AI pipeline (`POST /api/ai/transcript`)

1. Verify the session user is ADMIN (role read from the database) and the transcript is non-empty.
2. Load managers and developers and build a directory of `id, name, role, specialization, skills` only (no emails, no password hashes).
3. Send system prompt + directory + transcript + JSON schema to the LLM; parse the JSON reply.
4. Validate with Zod, then check: managers are MANAGERs, assignees are AGENTs, dates are real calendar dates, hours > 0, task deadline ≤ project deadline.
5. If the output is unusable, retry once, telling the model what was wrong.
6. Save all projects and tasks in one database transaction. Any failure saves nothing.

Nothing about any specific transcript is hardcoded: the answer comes from the model, so edited transcripts produce edited results.

## Local setup

Requires Node 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env        # then fill in the values below
npx prisma migrate dev --name init   # or: npx prisma db push
npm run seed
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for signing session cookies (`openssl rand -base64 32`) |
| `AI_API_KEY` | Anthropic API key (server-side only) |
| `AI_MODEL` | Optional model override (default `claude-sonnet-5-5`) |

`.env` is git-ignored. Never commit real secrets.

### Database setup and seed

- `npx prisma migrate dev --name init` creates the tables and a migration. For a quick hackathon setup `npx prisma db push` works too.
- `npm run seed` creates the demo users. It upserts by id, so running it repeatedly never creates duplicates.

## Demo credentials

Password for every account: `Demo123!`

| Role | Name | Email | ID |
| --- | --- | --- | --- |
| ADMIN | Admin | admin@novaworks.example | ADMIN01 |
| MANAGER | Ayesha Khan (Web PM) | ayesha@novaworks.example | PM01 |
| MANAGER | Bilal Ahmed (Mobile PM) | bilal@novaworks.example | PM02 |
| MANAGER | Hina Malik (AI PM) | hina@novaworks.example | PM03 |
| AGENT | Ali Raza (Full-Stack) | ali@novaworks.example | DEV01 |
| AGENT | Hamza Shah (Full-Stack) | hamza@novaworks.example | DEV02 |
| AGENT | Sara Noor (App Developer) | sara@novaworks.example | DEV03 |
| AGENT | Usman Tariq (App Developer) | usman@novaworks.example | DEV04 |
| AGENT | Zain Abbas (AI Developer) | zain@novaworks.example | DEV05 |
| AGENT | Maryam Asif (AI Developer) | maryam@novaworks.example | DEV06 |

## How to test the transcript conversion

1. Log in as `admin@novaworks.example`.
2. Click **+ Create from Transcript**.
3. Paste the meeting transcript and click **✨ Create Projects**.
4. Wait for the progress screen; on success you see the project and task counts.
5. Click **View Projects** and open a project to check managers, assignees, deadlines and hours.
6. Edit the transcript (for example change a task to 12 hours and a later date), create again, and confirm the new values appear. This proves the extraction is genuine.

Suggested checks for the supplied demo transcript: 3 projects, 12 tasks, final (corrected) deadlines and hours used, no tasks for rejected features, and no user or task for people who are not NovaWorks employees.

## Role-based access behavior

| Role | Projects | Tasks | Transcript creation |
| --- | --- | --- | --- |
| ADMIN | all | all | yes (only role) |
| MANAGER | where `managerId` is the user | all tasks in those projects | no (403) |
| AGENT | projects containing their tasks | only where `assigneeId` is the user | no (403) |

- Authorization is enforced in `lib/permissions.ts`; every page and API route reads data through it.
- Opening `/projects/<id>` for a project you are not entitled to shows an **Access denied** page, and `GET /api/projects/<id>` returns **403**.
- `POST /api/ai/transcript` returns 401 without a session and 403 for non-admins.
- Role and user id always come from the signed session and the database, never from the browser.

## Deployment (Vercel + Supabase)

1. Create a Supabase project and copy its Postgres connection string (use the pooled string for serverless).
2. From your machine with `DATABASE_URL` pointing at Supabase, run `npx prisma db push` (or `prisma migrate deploy` if you committed migrations) and `npm run seed`.
3. Import the repo into Vercel and set `DATABASE_URL`, `AUTH_SECRET`, `AI_API_KEY` (and optionally `AI_MODEL`).
4. Deploy. The build runs `prisma generate && next build`. The transcript route allows up to 60 seconds (`maxDuration`); your Vercel plan must allow that.

## Known limitations

- Double-submit protection on the server is an in-memory flag per server instance (the UI also disables the button); on multi-instance deployments it is best-effort.
- The progress steps on the transcript screen are cosmetic; the real work is one LLM call plus a database transaction.
- Re-submitting the same transcript creates a second set of projects (no de-duplication by name).
- No signup, password reset, user management, notifications, analytics or editing of projects and tasks; these are out of scope for the MVP.
- The LLM can occasionally misread a transcript. Validation catches structural and permission errors, but a human should skim results.
