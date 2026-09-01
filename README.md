# AI Job Matcher

> An AI-powered job matching platform built for the Moroccan tech ecosystem.

AI Job Matcher analyzes a candidate's CV, converts their profile into a semantic vector, and matches it against job postings using **PostgreSQL + pgvector**. It also generates tailored application materials for each matched position.

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

---

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

Make sure PostgreSQL has the `pgvector` extension installed.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  structured_data JSONB NOT NULL,
  embedding vector(768),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applications_and_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_posting_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  match_score NUMERIC(5,4),
  generated_cover_letter TEXT,
  generated_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_user_job
    UNIQUE (user_id, job_posting_id)
);
```

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
```

---

### 3. Initialize the Database

Run the SQL schema above inside PostgreSQL.

Then seed the development job data:

```bash
npx tsx src/config/seed.ts
```

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
POST /auth/register
POST /auth/login
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

The goal of AI Job Matcher is to make job discovery more relevant for developers and technology professionals in Morocco by replacing simple keyword-based matching with **semantic understanding**.

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
