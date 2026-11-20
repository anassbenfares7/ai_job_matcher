# AI Job Matcher

> An AI-powered job matching platform built for the Moroccan job market.

AI Job Matcher analyzes a candidate's CV, converts their profile into a semantic vector, and matches it against job postings using **PostgreSQL + pgvector**. It also generates tailored application materials for each matched position.

Job listings are pulled from the free [Jooble API](https://jooble.org/api/about) across a range of professions (IT, marketing, finance, HR, sales, engineering, logistics, healthcare) — it is not limited to tech roles.

The frontend uses a clean, Medium-inspired editorial interface focused on readability and distraction-free interaction.

---

## ✨ Features

- 📄 **AI CV Analysis** — Extract structured information from PDF resumes, including complex multi-column layouts.
- 🧠 **Semantic Job Matching** — Compare candidate profiles with job descriptions using 768-dimensional embeddings.
- 📊 **Match Scores** — Convert cosine similarity into an easy-to-understand percentage.
- ✍️ **AI Cover Letters** — Generate job-specific application materials.
- 🎯 **ATS Feedback** — Provide feedback aimed at improving application relevance.
- 💾 **Database Caching** — Store generated application materials to avoid unnecessary repeated AI requests.
- 🔐 **JWT Authentication** — Protected dashboard and authenticated API requests.
- ✅ **Admin Approval** — Every new signup is reviewed and approved by an admin before the account can sign in.
- 📱 **Responsive UI** — Editorial-style interface designed for desktop and mobile layouts.
- ⚡ **Fault-Tolerant Generation** — Retry generation requests when long-running AI operations cause network timeouts.

---

## 🚀 Deployment

**Ready for production?** Follow our deployment guides:

- **🎯 [Quick Start (5 min)](./QUICK_START.md)** — Deploy in minutes
- **📘 [Full Deployment Guide](./DEPLOYMENT.md)** — Step-by-step with Docker, CI/CD, and server setup
- **✅ [Production Checklist](./PRODUCTION_CHECKLIST.md)** — Pre-launch verification

### TL;DR

```bash
# Local testing
docker-compose up -d

# Production deployment
ssh root@your-server && \
curl -fsSL https://get.docker.com | sh && \
git clone <repo> /app && cd /app && \
docker-compose -f docker-compose.prod.yml up -d
```

### Load jobs for production (Cloudflare + Vercel + Neon)

Uploading a CV saves the candidate profile. Job recommendations come from
listings already stored in Neon; uploading a CV does not fetch listings.

1. In Neon, open **SQL Editor** and check whether listings are present:

```sql
SELECT COUNT(*) AS job_listings, COUNT(embedding) AS searchable_listings
FROM job_postings;
```

2. If either count is `0`, create or update `backend/.env` locally. Set
   `DATABASE_URL` to the **production Neon database/branch used by Vercel**.
   Keep the required `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, and `JWT_SECRET`
   values, and add `JOOBLE_API_KEY`. Do not commit this file.

3. From the repository folder, run this in the VS Code terminal:

```powershell
cd backend
npm ci
npm run build
npm run ingest:prod
```

Wait for the command to finish, then run the Neon count query again. Refresh the
website when `searchable_listings` is greater than `0`; you do not need to upload
the CV again.

This repository does not currently run job imports automatically on Vercel, so
repeat step 3 when you want to refresh listings. Do not use `npm run seed` in
production; it deletes existing job listings.

If the count query says `job_postings` does not exist, initialize the database
first: in Neon SQL Editor run `CREATE EXTENSION IF NOT EXISTS vector;`, then run
the contents of [`backend/src/config/schema.sql`](./backend/src/config/schema.sql).

---

### Admin dashboard

The admin dashboard is available at `/admin`. In Vercel, set `ADMIN_EMAIL` to
the exact email address of the approved admin account. The backend checks this
allowlist on every admin API request; hiding the page in the frontend is not
used as access control.

Apply the current [`backend/src/config/schema.sql`](./backend/src/config/schema.sql)
to Neon before deploying the backend so the account-suspension column exists.
Admins can review parsed CV profiles, approve accounts, suspend or restore
access, and permanently delete accounts. Original PDF files are not retained.
Permanent deletion also removes the account's parsed CV profiles and saved
matches.

```text
ai-job-matcher/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── Database & environment configuration
│   │   ├── controllers/
│   │   │   ├── Authentication
│   │   │   ├── Resume processing
│   │   │   ├── Job matching
│   │   │   └── Material generation
│   │   ├── middleware/
│   │   │   ├── JWT authentication
│   │   │   └── File upload handling
│   │   ├── routes/
│   │   │   └── API endpoint definitions
│   │   └── services/
│   │       ├── AI extraction
│   │       ├── Embeddings
│   │       └── Application generation
│   │
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/
│   │   │   └── dashboard/
│   │   ├── context/
│   │   │   └── AuthContext
│   │   └── services/
│   │       └── Axios API client
│   │
│   └── globals.css
│
└── README.md
```

---

## 🔄 How It Works

```text
                    ┌──────────────────┐
                    │  Register  →  Admin approves
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │    User Login    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │    Upload CV     │
                    │       PDF        │
                    └────────┬─────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │   AI Resume Analysis   │
                 │  Structured Extraction │
                 └────────────┬───────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │   Generate Embedding   │
                 │      768 dimensions    │
                 └────────────┬───────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │ PostgreSQL + pgvector    │
                │ Semantic Similarity      │
                └────────────┬─────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   Ranked Job Matches │
                  └──────────┬───────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │ Generate Application    │
                 │ Materials with AI       │
                 └────────────────────────┘
```

---

## 🧠 AI & Vector Matching

The core matching system uses **PostgreSQL with pgvector**.

Each candidate profile and job posting is represented as a **768-dimensional vector**.

The system then calculates semantic similarity using PostgreSQL's cosine-distance operator:

```sql
embedding <=> input_embedding
```

The distance is converted into a percentage score:

```text
match_score = (1 - cosine_distance) × 100
```

This allows the frontend to display results such as:

```text
Frontend Developer
Company: Example Company
Location: Casablanca

92% Match
```

---

## 🤖 AI Resume Processing

Instead of relying exclusively on traditional PDF text extraction, the system can send the resume PDF to the AI model as document data.

This makes the pipeline better suited for resumes containing:

- Multi-column layouts
- Visual formatting
- Canva-generated CVs
- Structured sections
- Non-standard resume designs

The AI extracts structured information that can then be embedded and stored in PostgreSQL.

---

## ✍️ Application Material Generation

For a selected job, the backend generates:

### Cover Letter

A customized cover letter based on the relationship between:

```text
Candidate Profile
       +
Job Description
       ↓
AI Generation
       ↓
Tailored Cover Letter
```

### ATS Feedback

The system also returns feedback highlighting areas where the application can better align with the target position.

Generated results are stored using a unique:

```text
(user_id, job_posting_id)
```

combination so repeated requests can reuse existing generated content.

---

## 🛠️ Tech Stack

### Frontend

| Technology   | Purpose           |
| ------------ | ----------------- |
| Next.js      | React framework   |
| React        | UI                |
| TypeScript   | Type safety       |
| Tailwind CSS | Styling           |
| Axios        | API communication |
| Lucide React | Icons             |

### Backend

| Technology | Purpose                  |
| ---------- | ------------------------ |
| Node.js    | Runtime                  |
| Express    | REST API                 |
| TypeScript | Type safety              |
| PostgreSQL | Database                 |
| pgvector   | Vector similarity search |
| JWT        | Authentication           |
| Multer     | File uploads             |

### AI

| Technology    | Purpose                      |
| ------------- | ---------------------------- |
| Gemini        | Resume analysis & generation |
| Embeddings    | Semantic representation      |
| Vector search | Candidate/job matching       |

---

## 🗄️ Database Schema

The application uses four main tables:

```text
users
 │
 └── resumes
       │
       └── embedding (vector 768)

job_postings
 │
 └── embedding (vector 768)

users + job_postings
        │
        ▼
applications_and_matches
        │
        ├── match_score
        ├── generated_cover_letter
        └── generated_feedback
```

### Database Setup

Make sure PostgreSQL has the `pgvector` extension installed, then run the schema:

```bash
psql "$DATABASE_URL" -f backend/src/config/schema.sql
```

[`backend/src/config/schema.sql`](./backend/src/config/schema.sql) is the single
source of truth for the schema. It is safe to run repeatedly — every statement is
guarded with `IF NOT EXISTS` / `IF EXISTS`, so it doubles as the migration you
run after pulling changes (e.g. on Railway after a deploy).

Tables: `users` (with `is_approved` + approval-token columns), `resumes`,
`job_postings`, `applications_and_matches`.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have:

- **Node.js 20+**
- **PostgreSQL**
- **pgvector**
- A **Google AI Studio API key**

---

### 1. Clone the Repository

```bash
git clone <your-repository-url>

cd ai-job-matcher
```

---

### 2. Configure the Backend

```bash
cd backend
npm install
```

Create:

```text
backend/.env
```

Add:

```env
PORT=5000

DATABASE_URL=postgresql://<username>:<password>@localhost:5432/ai_job_matcher

JWT_SECRET=your_jwt_secret

GEMINI_API_KEY=your_google_ai_studio_api_key

GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Signup approval emails (Resend — https://resend.com).
# When someone registers, a "please review" email is sent to ADMIN_EMAIL with a
# link to approve or reject them. The new user can't sign in until approved.
# Optional in development: without RESEND_API_KEY the backend prints the review
# link to the console instead of emailing it.
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=AI Job Matcher <onboarding@resend.dev>
ADMIN_EMAIL=you@example.com
# Base URL the review link points at (your frontend). Defaults to FRONTEND_URL.
APP_URL=http://localhost:3000

# Free key from https://jooble.org/api/about — only needed to pull real job listings
JOOBLE_API_KEY=your_jooble_api_key
```

> **Signup approval:** new email/password and Google accounts start as *pending*
> and cannot sign in until an admin approves them. Each signup sends a review
> email to `ADMIN_EMAIL` with an approve/reject link (page at `/admin/review`).
> In dev without a Resend key, copy the link from the backend console. Because
> these emails only ever go to you, `onboarding@resend.dev` works fine — no
> sending domain needed.
>
> Mail from the shared `onboarding@resend.dev` address often lands in **Spam** —
> mark it "not spam" once and add the sender to your contacts. For reliable inbox
> delivery, verify your own domain at resend.com/domains and set
> `EMAIL_FROM=you@yourdomain.com`.

---

### 3. Initialize the Database

Run the schema (see **Database Setup** above):

```bash
psql "$DATABASE_URL" -f backend/src/config/schema.sql
```

Then load job data. Two options:

```bash
# Real listings from the Jooble API (needs JOOBLE_API_KEY) — recommended
npm run ingest

# OR: 4 hand-written mock jobs, for offline/demo use with no Jooble key
npm run seed
```

`npm run ingest` fetches jobs across several professions, generates an embedding
for each, and skips any it has already stored (deduplicated by the provider's
job id). Re-run it any time to pull fresh listings. To clear everything and start
over: `TRUNCATE TABLE job_postings CASCADE;` then re-run.

---

### 4. Start the Backend

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

---

### 5. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

## 🎨 UI Design

The dashboard follows a **Medium-inspired editorial design system**.

### Design Principles

- Minimal visual noise
- Strong typography hierarchy
- Generous whitespace
- Serif typography for long-form content
- Sans-serif typography for interface elements
- Subtle borders instead of heavy cards
- Responsive layouts
- Focused application workflow

### Smart Navigation

The dashboard header reacts to scrolling:

```text
Scroll Down
    ↓
Header hides
    ↓
More reading space

Scroll Up
    ↓
Header returns
```

The implementation uses:

```text
window.scrollY
        ↓
Compare with previous position
        ↓
Scrolling down?
        ↓
translateY(-100%)
```

---

## 📡 API Overview

### Authentication

```http
POST /auth/register    # creates a pending account, emails the admin, returns no token
POST /auth/login       # 403 PENDING_APPROVAL until an admin approves the account
POST /auth/google      # same approval gate for new Google accounts
GET  /auth/review      # ?token=... → the pending signup's info (for the admin page)
POST /auth/approve     # { token } → approve the signup
POST /auth/reject      # { token } → reject and delete the signup
```

### Resume

```http
POST /resumes/upload
```

### Job Matching

```http
GET /matches
```

### Application Materials

```http
POST /materials/generate
```

---

## 📂 Project Status

> 🚧 **Development**

The current version focuses on the core end-to-end workflow:

```text
Authentication
      ↓
CV Upload
      ↓
AI Resume Processing
      ↓
Vector Embedding
      ↓
Semantic Job Matching
      ↓
Match Ranking
      ↓
AI Application Generation
```

---

## 🎯 Project Goal

The goal of AI Job Matcher is to make job discovery more relevant for job seekers across all professions in Morocco by replacing simple keyword-based matching with **semantic understanding**.

Instead of asking:

> "Does the CV contain the exact keyword?"

the system asks:

> "How semantically relevant is this candidate's profile to this job?"

---

## 👨‍💻 Author

Built as a full-stack AI engineering project focused on:

- AI integration
- Semantic search
- Vector databases
- PostgreSQL
- Full-stack TypeScript
- AI-assisted recruitment workflows

---

## 📄 License

This project is currently intended for educational and portfolio purposes.
