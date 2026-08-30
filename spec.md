# CollegeAI — RAG-Based College Knowledge Assistant

## 1. Document Status

- **Document:** Product and Technical Specification
- **Project:** CollegeAI
- **Project Type:** Full-stack AI application
- **Domain:** Education / Generative AI
- **Primary Users:** Students
- **Secondary Users:** College administrators
- **Development Method:** Specification-Driven Development (SDD)
- **Specification Rule:** This document is the source of truth for implementation.

---

## 2. Project Overview

Build a full-stack AI-powered college information assistant called **CollegeAI**.

CollegeAI allows students to ask college-related questions in natural language. The system retrieves relevant information from an administrator-managed knowledge base containing college PDFs, documents, notices, FAQs, policies, academic information, and other resources. It then uses the retrieved context to generate an answer and displays the source documents used.

The application must implement a real Retrieval-Augmented Generation (RAG) pipeline. A simple chatbot connected directly to an LLM is not sufficient.

### Primary Goal

Provide students with a reliable conversational interface for finding college information without manually searching through many documents.

### Core User Flow

```text
Student
  ↓
Login
  ↓
Ask Question
  ↓
Generate Question Embedding
  ↓
Vector/Semantic Search
  ↓
Retrieve Relevant Document Chunks
  ↓
Build Context
  ↓
LLM
  ↓
Grounded Answer
  ↓
Display Sources
```

---

## 3. Problem Statement

College information is often distributed across PDFs, notices, circulars, academic documents, FAQs, department resources, hostel information, examination documents, placement information, scholarship documents, and policies.

Students need a centralized way to ask questions and receive useful answers based on official college information.

CollegeAI solves this problem by creating a searchable AI knowledge assistant backed by a document-based RAG pipeline.

---

## 4. Target Users

### 4.1 Student

Students can:

- Register and log in.
- Ask college-related questions.
- View AI-generated answers.
- View source references.
- Continue conversations.
- Review previous conversations.
- Provide answer feedback.

### 4.2 Administrator

Administrators can:

- Log in through protected authentication.
- Upload college documents.
- View uploaded documents.
- Process documents.
- Delete documents.
- Organize documents by category.
- Monitor document processing.
- View basic usage and knowledge-base analytics.

---

## 5. Mandatory Functional Requirements

The following features are required.

### 5.1 Authentication

The system must support:

- Student registration.
- Student login.
- Logout.
- Protected pages/routes.
- Secure password handling.
- Persistent authenticated session.
- Role-based authorization for administrator functionality.

### 5.2 Chat Interface

The system must provide:

- New conversation.
- Question input.
- Send action.
- AI answer display.
- Loading state.
- Error state.
- Conversation history.
- Follow-up questions within a conversation.

### 5.3 Document Upload

Administrators must be able to:

- Upload supported documents/PDFs.
- Enter or assign document metadata.
- Assign a category.
- View processing status.
- Delete documents.

### 5.4 Document Processing

Uploaded documents must go through:

1. File validation.
2. Text extraction.
3. Text cleaning.
4. Text chunking.
5. Embedding generation.
6. Vector storage.
7. Metadata storage.

### 5.5 Embeddings

The application must generate embeddings for document chunks and user questions.

The implementation must use an embedding-capable provider and store embeddings in the configured vector database.

### 5.6 Semantic Search

For each user question:

1. Generate a question embedding.
2. Search the vector database.
3. Retrieve the most relevant chunks.
4. Apply the configured similarity/relevance threshold.
5. Pass relevant chunks to the RAG context builder.

### 5.7 RAG Generation

The LLM must receive:

- System instructions.
- User question.
- Retrieved document context.

The generated answer must be grounded in the retrieved context.

The system must not intentionally fabricate college-specific information.

### 5.8 Source References

Each RAG answer should display available source information such as:

- Document title.
- Page number when available.
- Relevant chunk/reference metadata.

### 5.9 Unknown Question Handling

If the knowledge base does not contain sufficient relevant information, the system must clearly state that the requested information is unavailable in the available college knowledge base.

The system must not present unsupported information as an official college answer.

### 5.10 Chat History

The system must store and display:

- Conversation.
- User questions.
- AI answers.
- Sources.
- Timestamps.

### 5.11 Admin Document Management

Administrators must be able to:

- List documents.
- Upload documents.
- Process documents.
- Delete documents.
- View document status.
- Filter documents by category/status where implemented.

---

## 6. Knowledge Categories

The system should support categories such as:

- Admissions
- Departments
- Courses
- Fees
- Examinations
- Academic Calendar
- Hostel
- Library
- Clubs
- Placements
- Scholarships
- Policies
- Events
- General

The category system must be extensible.

---

## 7. Recommended Advanced Features

After all mandatory features work, implement the following in priority order.

### Priority 1

- Streaming AI responses.
- Admin dashboard.
- Suggested questions.
- Answer feedback.
- Relevance/confidence information.
- Department-wise knowledge bases.

### Priority 2

- Hybrid keyword + semantic search.
- Document re-ranking.
- Automatic document summarization.
- Conversation export.
- Multilingual chatbot.

### Priority 3

- OCR for scanned documents.
- Voice input.
- Voice responses.
- AI-generated FAQs.

Advanced features must not compromise the mandatory RAG pipeline.

---

## 8. RAG Architecture

The implementation must follow this logical pipeline:

```text
                 ┌────────────────────┐
                 │ College Documents  │
                 └─────────┬──────────┘
                           ↓
                  Text Extraction
                           ↓
                     Text Cleaning
                           ↓
                       Chunking
                           ↓
                   Embedding Model
                           ↓
                    Vector Database
                           │
                           │
Student Question ──────────┘
       ↓
Question Embedding
       ↓
Similarity Search
       ↓
Top-K Relevant Chunks
       ↓
Context Builder
       ↓
LLM
       ↓
Grounded Answer
       ↓
Source References
```

---

## 9. Technology Stack

Use explicit technologies and do not switch frameworks without updating this specification.

### Frontend

- Next.js
- React
- Tailwind CSS
- Axios or equivalent HTTP client

### Backend

- Node.js
- Express.js

### AI

- LLM API
- Embedding API
- RAG orchestration implemented in the backend

### Database

- Supabase PostgreSQL
- pgvector for vector storage/search

### Authentication

- JWT-based authentication
- Password hashing

### Document Processing

- PDF/document text extraction library appropriate for Node.js.
- Server-side text chunking.

### Deployment

- GitHub for source code.
- Vercel for frontend.
- Render for backend.
- Supabase for database and vector storage.

---

## 10. Architecture Rules

The application must use clear separation of concerns.

```text
Frontend
   ↓
HTTP API
   ↓
Routes
   ↓
Controllers
   ↓
Services
   ↓
Database / Vector Store / AI Providers
```

### Rules

- Controllers must remain thin.
- Business logic belongs in services.
- Authentication must be implemented through middleware.
- Database access must not be scattered through controllers.
- AI/RAG logic must be isolated in dedicated services.
- Document processing must be isolated from HTTP route handling.
- Secrets must come from environment variables.
- Frontend code must never contain private API keys or database credentials.
- Admin endpoints must require administrator authorization.
- Errors must be handled consistently.
- External provider failures must produce useful application errors.

---

## 11. Frontend Pages

### `/`

Landing page containing:

- CollegeAI introduction.
- Product explanation.
- RAG explanation.
- Login/register CTAs.
- Responsive layout.

### `/login`

Must provide:

- Email input.
- Password input.
- Validation.
- Login action.
- Loading state.
- Error state.
- Link to registration.

### `/register`

Must provide:

- Name.
- Email.
- Password.
- Password confirmation/validation.
- Registration action.
- Error handling.

### `/chat`

Main student workspace containing:

- Conversation sidebar.
- New conversation action.
- Message list.
- User messages.
- AI responses.
- Source references.
- Question input.
- Loading/streaming state.
- Error state.

### `/chat/[id]`

Conversation details page or equivalent routed conversation view.

### `/documents`

Admin-only document management page containing:

- Upload interface.
- Document list.
- Category.
- Processing status.
- Delete action.
- Document metadata.

### `/admin`

Admin dashboard containing:

- Total documents.
- Total users.
- Total questions.
- Knowledge-base statistics.
- Basic usage analytics.

### `/settings`

User settings containing:

- Profile information.
- Authentication/session controls.
- Application preferences where implemented.

---

## 12. Backend API Specification

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Chat

```text
POST   /api/chat
GET    /api/chat/history
GET    /api/chat/:id
DELETE /api/chat/:id
```

### Documents

```text
POST   /api/documents
GET    /api/documents
GET    /api/documents/:id
DELETE /api/documents/:id
POST   /api/documents/:id/process
```

### Admin

```text
GET /api/admin/dashboard
GET /api/admin/users
GET /api/admin/analytics
```

### Health

```text
GET /api/health
```

All protected endpoints must verify authentication. Admin endpoints must additionally verify administrator authorization.

---

## 13. Database Specification

### 13.1 Users

```text
users
- id
- name
- email
- password_hash
- role
- created_at
- updated_at
```

Roles:

```text
student
admin
```

### 13.2 Documents

```text
documents
- id
- title
- filename
- category
- uploaded_by
- processing_status
- page_count
- file_metadata
- created_at
- updated_at
```

Processing statuses should include:

```text
UPLOADED
PROCESSING
PROCESSED
FAILED
```

### 13.3 Document Chunks

```text
document_chunks
- id
- document_id
- content
- embedding
- page_number
- chunk_index
- metadata
- created_at
```

The embedding field must use the vector type/configuration supported by the selected pgvector setup.

### 13.4 Conversations

```text
conversations
- id
- user_id
- title
- created_at
- updated_at
```

### 13.5 Messages

```text
messages
- id
- conversation_id
- role
- content
- sources
- relevance_score
- created_at
```

Allowed message roles:

```text
user
assistant
```

---

## 14. Document Processing Specification

When a document is uploaded:

```text
Upload
 ↓
Validate file
 ↓
Store file/metadata
 ↓
Extract text
 ↓
Clean text
 ↓
Split into chunks
 ↓
Generate embeddings
 ↓
Store chunks + vectors
 ↓
Mark document PROCESSED
```

If processing fails:

```text
Processing Error
 ↓
Store useful error information
 ↓
Mark document FAILED
```

The system must not leave a document permanently stuck in a processing state without an observable error/status.

---

## 15. Chunking Specification

The chunking service must:

- Split extracted text into manageable chunks.
- Preserve useful context.
- Track source document.
- Track page number when available.
- Track chunk index.
- Avoid creating empty chunks.
- Store metadata with every chunk.

Chunk size and overlap should be configurable through environment variables or centralized configuration rather than scattered hardcoded values.

---

## 16. Retrieval Specification

For every question:

```text
1. Validate authenticated user.
2. Validate question.
3. Generate question embedding.
4. Perform vector similarity search.
5. Retrieve top-K relevant chunks.
6. Apply relevance threshold.
7. Build context.
8. Generate answer.
9. Store answer and sources.
10. Return response.
```

The number of retrieved chunks (`TOP_K`) must be configurable.

---

## 17. LLM Prompting Rules

The RAG system prompt must instruct the LLM to:

- Answer using the supplied context.
- Prefer information from retrieved college documents.
- Avoid inventing unsupported college-specific facts.
- Clearly indicate when the context does not contain the answer.
- Keep answers useful and understandable.
- Preserve important qualifications, dates, requirements, and conditions from the source material.

The exact provider implementation may vary, but the grounding behavior must remain consistent.

---

## 18. Source Metadata

A source object should contain, where available:

```json
{
  "documentId": "...",
  "documentTitle": "...",
  "pageNumber": 4,
  "chunkId": "...",
  "relevanceScore": 0.87
}
```

The frontend should render human-readable source information.

---

## 19. Authentication and Security

The application must:

- Hash passwords securely.
- Use JWT authentication.
- Protect private API routes.
- Protect admin routes with role checks.
- Validate request bodies.
- Validate uploaded files.
- Restrict acceptable document types.
- Apply reasonable upload-size limits.
- Keep API keys server-side.
- Keep database credentials server-side.
- Never commit `.env` files.
- Never log private credentials.
- Return safe error messages to clients.
- Use environment variables for secrets.

Example environment variables:

```text
PORT=
DATABASE_URL=
JWT_SECRET=
LLM_API_KEY=
EMBEDDING_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VECTOR_TABLE=
TOP_K=
CHUNK_SIZE=
CHUNK_OVERLAP=
```

Actual secret values must never appear in source code or documentation.

---

## 20. Error Handling

Use consistent error responses.

Example:

```json
{
  "success": false,
  "error": {
    "code": "DOCUMENT_PROCESSING_FAILED",
    "message": "The document could not be processed."
  }
}
```

Important error categories include:

```text
AUTHENTICATION_REQUIRED
INVALID_CREDENTIALS
FORBIDDEN
VALIDATION_ERROR
DOCUMENT_NOT_FOUND
INVALID_FILE
DOCUMENT_PROCESSING_FAILED
EMBEDDING_PROVIDER_ERROR
VECTOR_SEARCH_ERROR
LLM_PROVIDER_ERROR
NO_RELEVANT_CONTEXT
INTERNAL_SERVER_ERROR
```

The frontend must show user-friendly messages rather than raw server errors.

---

## 21. UI/UX Requirements

The application must:

- Be responsive.
- Work on desktop and mobile layouts.
- Provide clear navigation.
- Provide loading states.
- Provide skeleton/loading indicators where useful.
- Provide empty states.
- Provide error states.
- Clearly distinguish user and AI messages.
- Clearly display sources.
- Make document processing status visible to administrators.
- Avoid exposing technical secrets.
- Use a clean modern AI assistant interface.

---

## 22. Suggested Component Structure

```text
client/
└── src/
    ├── components/
    │   ├── Layout/
    │   ├── Chat/
    │   ├── Message/
    │   ├── SourceList/
    │   ├── ConversationSidebar/
    │   ├── DocumentUpload/
    │   ├── DocumentTable/
    │   ├── ProcessingStatus/
    │   └── Loading/
    │
    ├── pages/
    │   ├── index
    │   ├── login
    │   ├── register
    │   ├── chat
    │   ├── documents
    │   ├── admin
    │   └── settings
    │
    ├── services/
    │   └── api
    │
    ├── store/
    │   ├── authStore
    │   └── chatStore
    │
    └── utils/
```

---

## 23. Suggested Backend Structure

```text
server/
└── src/
    ├── config/
    │   ├── env.js
    │   └── database.js
    │
    ├── routes/
    │   ├── authRoutes.js
    │   ├── chatRoutes.js
    │   ├── documentRoutes.js
    │   └── adminRoutes.js
    │
    ├── controllers/
    │   ├── authController.js
    │   ├── chatController.js
    │   ├── documentController.js
    │   └── adminController.js
    │
    ├── services/
    │   ├── authService.js
    │   ├── chatService.js
    │   ├── ragService.js
    │   ├── embeddingService.js
    │   ├── llmService.js
    │   ├── documentService.js
    │   ├── vectorService.js
    │   └── storageService.js
    │
    ├── models/
    │   ├── userModel.js
    │   ├── documentModel.js
    │   ├── chunkModel.js
    │   ├── conversationModel.js
    │   └── messageModel.js
    │
    ├── middleware/
    │   ├── authMiddleware.js
    │   ├── adminMiddleware.js
    │   ├── uploadMiddleware.js
    │   └── errorMiddleware.js
    │
    ├── utils/
    │   ├── pdfExtractor.js
    │   ├── textChunker.js
    │   └── response.js
    │
    └── app.js
```

---

## 24. Development Phases

### Phase 1 — Project Foundation

Implement:

- Repository structure.
- Frontend setup.
- Backend setup.
- Environment configuration.
- Supabase connection.
- Database schema.
- Authentication.
- Protected routes.
- Basic application layout.
- Health endpoint.

**Acceptance criteria:**

- Application starts locally.
- Database connection works.
- User can register.
- User can login.
- Protected route rejects unauthenticated requests.
- `/api/health` responds successfully.

---

### Phase 2 — Document Management

Implement:

- Admin authorization.
- Document upload.
- File validation.
- Document metadata.
- Document listing.
- Document deletion.
- PDF extraction.
- Text chunking.
- Processing status.

**Acceptance criteria:**

- Admin can upload a valid document.
- Invalid files are rejected.
- Text is extracted.
- Chunks are generated.
- Processing status is visible.
- Admin can delete documents.

---

### Phase 3 — Embeddings and Vector Search

Implement:

- Embedding service.
- pgvector configuration.
- Chunk embeddings.
- Vector storage.
- Similarity search.
- Top-K retrieval.
- Relevance threshold.

**Acceptance criteria:**

- Uploaded document chunks have embeddings.
- A question generates an embedding.
- Similarity search returns relevant chunks.
- Irrelevant questions can produce no useful context.

---

### Phase 4 — RAG Chatbot

Implement:

- Chat API.
- RAG context builder.
- LLM service.
- Grounded prompting.
- Source references.
- Unknown-question handling.
- Conversation storage.
- Chat history.

**Acceptance criteria:**

- Student can ask a question.
- Relevant document chunks are retrieved.
- LLM receives retrieved context.
- Answer is returned.
- Sources are displayed.
- Unknown questions are handled safely.
- Conversation history is persisted.

---

### Phase 5 — UI and Admin Dashboard

Implement:

- Complete chat interface.
- Conversation sidebar.
- Document management UI.
- Admin dashboard.
- Loading states.
- Error states.
- Responsive layout.
- Suggested questions.
- Feedback.

**Acceptance criteria:**

- Student can use the complete application without API tools.
- Admin can manage the knowledge base through the UI.
- UI works on desktop and mobile layouts.

---

### Phase 6 — Advanced RAG

Implement selected advanced features:

- Streaming responses.
- Hybrid search.
- Re-ranking.
- Multilingual support.
- Document summarization.
- Analytics.

Only implement advanced features after the mandatory pipeline is stable.

---

### Phase 7 — Production Deployment

Deploy:

```text
GitHub
   ├──→ Vercel
   │     └── Frontend
   │
   └──→ Render
         └── Backend
               │
               ↓
            Supabase
        Database + pgvector
```

Configure:

- Production environment variables.
- CORS.
- Frontend API URL.
- Backend URL.
- Supabase production settings.
- Authentication configuration.
- File/storage configuration.
- Production logging.

---

## 25. Testing Requirements

### Authentication Tests

- Register with valid data.
- Register with duplicate email.
- Login with valid credentials.
- Login with invalid credentials.
- Access protected route without authentication.
- Access admin route as student.
- Logout.

### Document Tests

- Upload valid PDF.
- Upload unsupported file.
- Upload oversized file.
- Process document.
- Verify extracted text.
- Verify chunks.
- Verify embeddings.
- Delete document.

### RAG Tests

- Ask question directly answered by a document.
- Ask question requiring multiple chunks.
- Ask irrelevant question.
- Ask question with no matching knowledge.
- Verify source references.
- Verify retrieved context.
- Verify answer grounding.

### Chat Tests

- Create conversation.
- Send message.
- Receive answer.
- Continue conversation.
- View history.
- Delete conversation.

### Production Tests

- Frontend loads.
- Backend health endpoint works.
- Database connection works.
- Authentication works.
- Document processing works.
- RAG works.
- Source references work.
- API requests work.
- Mobile layout works.
- Browser console has no major errors.
- No secrets are exposed.

---

## 26. Performance Requirements

The implementation should:

- Avoid loading entire documents into memory unnecessarily.
- Process documents asynchronously where appropriate.
- Limit retrieved chunks.
- Avoid unnecessary LLM calls.
- Cache reusable information where appropriate.
- Paginate document and conversation lists.
- Use database indexes for frequently queried fields.

Exact performance targets can be defined after the first working implementation.

---

## 27. Deployment Requirements

### Source Code

Repository must contain:

```text
project/
├── frontend/
├── backend/
├── README.md
└── .gitignore
```

### Must not contain

```text
.env
API keys
Database passwords
JWT secrets
OAuth secrets
Private credentials
```

### Deployment

- Frontend: Vercel.
- Backend: Render.
- Database/vector store: Supabase.

The deployed application must be accessible online.

---

## 28. README Requirements

The final README must contain:

1. Project Name
2. Problem Statement
3. Features
4. Technology Stack
5. Architecture
6. RAG Pipeline
7. Database Structure
8. API Documentation
9. Screenshots
10. Live Demo URL
11. Backend API URL
12. Local Setup Instructions
13. Environment Variables
14. Testing
15. Deployment
16. Future Improvements

Do not expose secret values.

---

## 29. Final Acceptance Criteria

The project is complete only when:

- [ ] Student registration works.
- [ ] Student login works.
- [ ] Logout works.
- [ ] Protected routes work.
- [ ] Admin authorization works.
- [ ] Admin can upload documents.
- [ ] Documents are processed.
- [ ] Text is extracted.
- [ ] Text is chunked.
- [ ] Embeddings are generated.
- [ ] Embeddings are stored.
- [ ] Vector search works.
- [ ] RAG retrieves relevant context.
- [ ] LLM generates grounded answers.
- [ ] Sources are displayed.
- [ ] Unknown questions are handled.
- [ ] Chat history works.
- [ ] Admin can delete documents.
- [ ] Database works.
- [ ] Frontend/backend integration works.
- [ ] Responsive UI works.
- [ ] Application is deployed.
- [ ] GitHub repository is complete.
- [ ] README is complete.
- [ ] No secrets are committed.
- [ ] The developer can explain the complete architecture and implementation.

---

## 30. AI Coding Agent Instructions

When using Codex, Cursor, GitHub Copilot, or another AI coding agent:

1. Read this `spec.md` before making changes.
2. Treat this file as the source of truth.
3. Do not build the entire application in one step.
4. Implement one development phase at a time.
5. Before each phase, inspect the existing repository.
6. Do not replace working code unnecessarily.
7. Preserve existing architecture unless the specification requires a change.
8. Do not invent API routes that conflict with this specification.
9. Do not switch frameworks without explicit approval.
10. Keep controllers thin.
11. Put business logic in services.
12. Keep secrets in environment variables.
13. Never commit `.env`.
14. Never expose private API keys in frontend code.
15. Add validation and error handling.
16. Test each phase before moving to the next phase.
17. After each phase, report:
    - Files created.
    - Files modified.
    - Files deleted, if any.
    - Features implemented.
    - Tests performed.
    - Known issues.
    - Next recommended phase.
18. Do not claim a feature works unless it has been tested.
19. Ask for clarification only when the specification genuinely leaves a required implementation decision unresolved.
20. Prefer simple, maintainable implementations over unnecessary complexity.

---

## 31. Phase Completion Report Format

At the end of every phase, produce:

```text
PHASE: <number>

STATUS:
COMPLETE / PARTIAL / BLOCKED

FILES CREATED:
- ...

FILES MODIFIED:
- ...

FILES DELETED:
- ...

FEATURES IMPLEMENTED:
- ...

TESTS PERFORMED:
- ...

TEST RESULTS:
- ...

KNOWN ISSUES:
- ...

ENVIRONMENT VARIABLES REQUIRED:
- ...

NEXT PHASE:
- ...
```

---

## 32. Final Product Vision

CollegeAI should feel like a modern college knowledge assistant rather than a generic chatbot.

The final user experience should be:

```text
Student
   ↓
Ask a college question
   ↓
CollegeAI searches official knowledge
   ↓
Relevant information is retrieved
   ↓
AI explains the answer
   ↓
Sources are shown
   ↓
Student can continue the conversation
```

The defining technical feature of the project is the complete RAG pipeline:

```text
Documents
→ Text Extraction
→ Chunking
→ Embeddings
→ Vector Database
→ Similarity Search
→ Relevant Context
→ LLM
→ Grounded Answer
→ Sources
```

The project must demonstrate that the developer understands, can test, customize, and explain the system rather than merely generating a UI or connecting a chatbot directly to an LLM.
