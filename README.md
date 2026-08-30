# CollegeAI — RAG-Based College Knowledge Assistant

CollegeAI is a full-stack Retrieval-Augmented Generation (RAG) web application designed to help students quickly find reliable, accurate, and grounded information from official college documents, PDFs, notices, examination rules, hostel circulars, and departmental FAQs.

---

## 1. Problem Statement

College information is fragmented across dozens of PDFs, notice boards, circulars, department pages, fee schedules, hostel rules, placement brochures, and policy handbooks. Students often struggle to find exact official answers without manually reading long documents.

**CollegeAI** solves this problem by building a centralized, searchable AI knowledge assistant backed by a document-based RAG pipeline. Instead of hallucinating answers, CollegeAI searches through administrator-managed official documents and returns grounded answers accompanied by explicit document title and page citations.

---

## 2. Key Features

- **Student Chat Workspace**: Natural language conversational assistant with follow-up support and chat history persistence.
- **RAG Grounded Generation**: Answers are synthesized strictly from retrieved official college context.
- **Source Citations**: Displays source document title, page numbers, category, and relevance score percentages.
- **Unknown Question Safety**: Informs users explicitly if requested information is not present in official college records rather than inventing details.
- **Admin Document Management**: Interface to upload PDFs, assign categories, track real-time processing status, and delete records.
- **Vector Chunk Inspector**: Interactive modal allowing administrators to inspect extracted text chunks, character lengths, and vector index details.
- **Admin System Dashboard**: Real-time analytics on total documents, active users, query counts, and category distribution.
- **Role-Based Security**: Role-based access control (Student vs Administrator) with JWT authentication and bcrypt password hashing.

---

## 3. Technology Stack

### Frontend
- **Framework**: Next.js 14 & React 18
- **Styling**: Tailwind CSS with custom glassmorphism design system & micro-animations
- **Icons**: Lucide React
- **HTTP Client**: Axios with JWT interceptors

### Backend
- **Runtime**: Node.js & Express.js
- **Document Parser**: `pdf-parse` for text extraction & page mapping
- **Text Chunking**: Sliding-window recursive text splitter with overlap
- **Authentication**: JSON Web Tokens (JWT) & `bcryptjs` password hashing

### Database & Vector Store
- **Database**: Supabase PostgreSQL
- **Vector Search Engine**: `pgvector` extension with Cosine Distance function (`match_document_chunks`)

---

## 4. Architecture & RAG Pipeline

```text
                                 ┌────────────────────────┐
                                 │ Admin Uploads Document │
                                 └───────────┬────────────┘
                                             ↓
                                      Text Extraction
                                             ↓
                                       Text Cleaning
                                             ↓
                                   Overlapping Chunking
                                             ↓
                                    Embedding Generation
                                             ↓
                               Supabase PostgreSQL (pgvector)
                                             │
                                             │
Student Question ────────────────────────────┘
       ↓
Question Embedding
       ↓
Cosine Similarity Search
       ↓
Top-K Relevant Chunks
       ↓
Grounded Prompt Context Builder
       ↓
LLM Answer Synthesizer
       ↓
Student Answer + Source Citations
```

---

## 5. Database Structure

The PostgreSQL database (configured with `pgvector`) contains 5 core tables defined in `server/schema.sql`:

1. **`users`**: User identity, email, password hash, and role (`student` or `admin`).
2. **`documents`**: Metadata for uploaded files, category, status (`UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED`), and page count.
3. **`document_chunks`**: Text passages, chunk index, page number, and `embedding` (`vector(1536)`).
4. **`conversations`**: Chat thread sessions per user.
5. **`messages`**: Question/Answer history with stored sources and relevance scores.

---

## 6. Backend API Reference

### Authentication
- `POST /api/auth/register` — Register a student or admin account
- `POST /api/auth/login` — Login & receive JWT token
- `POST /api/auth/logout` — Invalidate user session
- `GET  /api/auth/me` — Fetch currently authenticated user profile

### Chat & RAG
- `POST   /api/chat` — Submit a question to the RAG pipeline
- `GET    /api/chat/history` — Get user conversation list
- `GET    /api/chat/:id` — Get single conversation messages
- `DELETE /api/chat/:id` — Delete conversation

### Documents (Admin Only)
- `POST   /api/documents` — Upload & process PDF/document
- `GET    /api/documents` — List uploaded documents (optional `?category=...`)
- `GET    /api/documents/:id` — Get document metadata & chunk vector details
- `DELETE /api/documents/:id` — Delete document and associated chunks
- `POST   /api/documents/:id/process` — Trigger re-processing

### Admin & System
- `GET /api/admin/dashboard` — System statistics summary
- `GET /api/admin/users` — List registered users
- `GET /api/admin/analytics` — Detailed category breakdown
- `GET /api/health` — Health check status

---

## 7. Step-by-Step Local Setup Guide

Follow these steps to run CollegeAI locally on your system.

### Prerequisites
- **Node.js** (v18+ recommended)
- **npm** or **yarn**
- **Git**

### Step 1: Clone Repository & Navigate
```bash
git clone https://github.com/your-username/CollegeAI.git
cd CollegeAI
```

### Step 2: Database Setup (Supabase / PostgreSQL)
1. Log in to your [Supabase Dashboard](https://supabase.com) and create a new project.
2. Open the **SQL Editor** in Supabase.
3. Copy the contents of `server/schema.sql` and run it. This enables the `vector` extension, creates tables, indexes, and the `match_document_chunks` stored procedure.

### Step 3: Environment Setup
1. Create `.env` file in `server/`:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://postgres:password@localhost:5432/collegeai
   JWT_SECRET=super-secret-jwt-key-collegeai-2026
   LLM_API_KEY=your-llm-api-key
   EMBEDDING_API_KEY=your-embedding-api-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   VECTOR_TABLE=document_chunks
   TOP_K=5
   CHUNK_SIZE=800
   CHUNK_OVERLAP=150
   RELEVANCE_THRESHOLD=0.1
   ```

2. Create `.env.local` file in `client/`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

### Step 4: Run Both Frontend & Backend in One Command
Run this command from the **root directory**:

```bash
npm run dev
```

This single command launches both:
- **Backend Express Server**: `http://localhost:5000`
- **Frontend Next.js App**: `http://localhost:3000`

*(To install all dependencies for both sub-projects at once, run `npm run install:all` from the root directory).*
3. Start frontend dev server:
   ```bash
   npm run dev
   ```
4. Open browser at `http://localhost:3000`.

---

## 8. Environment Variables Reference

| Variable | Description |
| :--- | :--- |
| `PORT` | Backend server port (Default: 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key used for signing JWT auth tokens |
| `LLM_API_KEY` | API Key for LLM provider (e.g. OpenAI / Gemini) |
| `EMBEDDING_API_KEY` | API Key for Vector Embedding provider |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key |
| `TOP_K` | Number of relevant chunks retrieved per question (Default: 5) |
| `CHUNK_SIZE` | Max character length per document chunk (Default: 800) |
| `CHUNK_OVERLAP` | Overlap character length between chunks (Default: 150) |

---

## 9. Testing & Verification

Run automated API test suite in `server/`:
```bash
cd server
npm test
```
The verification script tests:
1. `/api/health` endpoint
2. Student registration & JWT token issuance
3. Admin registration & permission elevation
4. Role-based guard verification (rejecting non-admin access)
5. Admin analytics retrieval

---

## 10. Production Deployment Guide

Follow this guide to deploy CollegeAI live to **Supabase**, **Render**, **Vercel**, and **GitHub**.

```text
GitHub Repo ────────────────┐
                            ├──→ Render (Backend Web Service: server/render.yaml)
                            │       │
                            │       ▼
                            │    Supabase PostgreSQL + pgvector (server/schema.sql)
                            │
                            └──→ Vercel (Frontend Next.js App: client/vercel.json)
```

### Step 1: Database Setup on Supabase
1. Go to [Supabase Console](https://supabase.com) and create a project.
2. Go to **SQL Editor** and paste the content of `server/schema.sql`.
3. Click **Run** to set up tables, `vector` extension, and stored functions (`match_document_chunks`).
4. Copy your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from **Project Settings → API**.

### Step 2: Backend Deployment on Render
1. Push your code to **GitHub**.
2. Go to [Render Dashboard](https://render.com) → **New Web Service**.
3. Connect your GitHub repository and select `server` as root directory (or use `server/render.yaml`).
4. Configure environment variables in Render:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `<generated-random-secret>`
   - `SUPABASE_URL`: `<your-supabase-url>`
   - `SUPABASE_SERVICE_ROLE_KEY`: `<your-service-role-key>`
   - `LLM_API_KEY`: `<your-llm-api-key>`
   - `CLIENT_URL`: `https://your-collegeai-frontend.vercel.app`
5. Click **Deploy Web Service**. Note your backend URL (e.g. `https://collegeai-backend.onrender.com`).

### Step 3: Frontend Deployment on Vercel
1. Go to [Vercel Dashboard](https://vercel.com) → **Add New Project**.
2. Import your GitHub repository and set **Root Directory** to `client`.
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://collegeai-backend.onrender.com/api`
4. Click **Deploy**. Vercel will build and host your production frontend.

---

## 11. Implemented Advanced RAG Features (Phase 6)

- **Streaming AI Responses (SSE)**: Word-by-word streaming generation via `POST /api/chat/stream`.
- **Hybrid Search & Re-Ranking**: Reciprocal Rank Fusion (RRF) combining dense vector embeddings with BM25 term matching.
- **Department-Wise Scoping**: Search scope filtering by department/category (`Admissions`, `Hostel`, `Fees`, `Examinations`, etc.).
- **Automatic Summarization**: Bullet-point AI summaries generated upon document upload.
- **Conversation Export**: Export chat threads as formatted Markdown files.
