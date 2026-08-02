# SwasthyaSetu — Clinical Decision Support Platform

> **Tetrathon 2026 · TETRA006**  
> A full-stack AI-powered personal health monitoring and clinical decision support system designed to make proactive healthcare accessible to every patient, regardless of their technical background.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Monorepo Structure](#monorepo-structure)
4. [Tech Stack](#tech-stack)
5. [Backend](#backend)
   - [Infrastructure & Databases](#infrastructure--databases)
   - [API Routes](#api-routes)
   - [Service Layer](#service-layer)
   - [Data Models](#data-models)
   - [Key Backend Optimizations](#key-backend-optimizations)
6. [MedGemma Inference Service](#medgemma-inference-service)
7. [Frontend](#frontend)
   - [Pages & Routing](#pages--routing)
   - [Components](#components)
   - [State Management](#state-management)
   - [Key Frontend Optimizations](#key-frontend-optimizations)
8. [Clinical Features](#clinical-features)
9. [Security & Privacy](#security--privacy)
10. [Running the Project](#running-the-project)
11. [Environment Variables](#environment-variables)
12. [API Reference Summary](#api-reference-summary)

---

## Project Overview

SwasthyaSetu is a **patient-centric health monitoring platform** with a built-in AI clinical assistant. It targets individuals managing chronic conditions such as hypertension, diabetes, and kidney disease — conditions that require regular monitoring but rarely get continuous clinical attention between hospital visits.

**Core capabilities:**

| Feature | Description |
|---|---|
| **Vital Signs Logging** | Log BP, blood sugar, heart rate, creatinine, weight, hydration, and sleep |
| **AI Medical Chat** | Multi-turn conversational AI (MedGemma) with STT voice input and TTS audio output |
| **Lab Report Scanner** | Upload PDF/image lab reports; auto-extract clinical values via client-side compressed upload + OCR/LLM |
| **Clinical Risk Indicators** | Real-time ASCVD 10-year risk, diabetes risk stage, kidney GFR stage, BP classification |
| **Emergency SOS** | One-tap GPS-based ambulance dispatch with real-time WebSocket status updates |
| **Clinician Portal** | Secure OTP-based patient record access, medication updates, triage escalations |
| **Health Passport** | Exportable HTML health summary with full vitals history and AI analysis |
| **Multilingual Support** | AI queries detected and translated; responses returned in patient's language |

---

## System Architecture

```
┌──────────────────────────────────────────────────────┐
│                     FRONTEND                         │
│          Next.js 14 · App Router · React 18          │
│  PatientDashboard · ChatAssistant · LabReports · ... │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS / WSS
                        │ Cloudflare Tunnel
                        ▼
┌──────────────────────────────────────────────────────┐
│                    BACKEND API                        │
│            FastAPI (async) · Python 3.11             │
│  /auth  /patient  /clinician  /query  /reports       │
└───┬──────────┬──────────┬────────────┬───────────────┘
    │          │          │            │
    ▼          ▼          ▼            ▼
┌───────┐ ┌───────┐ ┌─────────┐ ┌──────────┐
│Postgres│ │ Redis │ │ Qdrant  │ │  Kafka   │
│+pgvec │ │ Cache │ │Semantic │ │Audit Log │
│  ORM  │ │ OTP   │ │ Search  │ │ MedGemma │
└───────┘ └───────┘ └─────────┘ └────┬─────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │  MedGemma Inference      │
                        │  Worker Service          │
                        │  (Kafka Consumer +       │
                        │   Google Gemma LLM)      │
                        └─────────────────────────┘
```

**Request flow for a clinical AI query:**

```
Patient types/speaks query
        │
        ▼
STT (Web Speech API) → text
        │
        ▼
POST /query  (FastAPI)
        │
        ├─► Language Detection (translation.py)
        │
        ├─► Session Manager — multi-turn dialog state (Redis)
        │
        ├─► Semantic Cache lookup (Qdrant)  ──► Hit? return cached response
        │
        ├─► Parallel Retrieval:
        │     • Hot vitals  (Redis L1)
        │     • Semantic history  (Qdrant L2)
        │     • Warm vitals + reports  (PostgreSQL L3)
        │
        ├─► Safety Layer — ASCVD, DDI, urgency flags
        │
        ├─► Context Assembler → MedGemma prompt
        │
        ├─► Kafka request-reply → MedGemma Worker → Inference
        │
        ├─► Response Translation (back to patient language)
        │
        ├─► Persist ChatSession + ChatMessage (PostgreSQL)
        │
        └─► Return JSON to frontend
                │
                ▼
     TTS (ElevenLabs via /query/tts) if Voice Mode on
```

---

## Monorepo Structure

```
TETRA006/
├── backend/                     # FastAPI backend
│   └── app/
│       ├── main.py              # App factory, middleware, router registration
│       ├── config.py            # Settings from .env
│       ├── db/
│       │   ├── postgres.py      # Async SQLAlchemy engine
│       │   ├── redis.py         # Redis client + rate limiter
│       │   ├── qdrant.py        # Qdrant vector DB client
│       │   └── kafka.py         # Kafka producer/consumer
│       ├── models/
│       │   ├── all_models.py    # SQLAlchemy ORM models
│       │   └── schemas.py       # Pydantic request/response schemas
│       ├── routes/
│       │   ├── auth.py          # /auth/register, /auth/login
│       │   ├── patient.py       # /patient/* (profile, vitals, indicators, SOS)
│       │   ├── clinician.py     # /clinician/* (triage, patient records, emergencies)
│       │   ├── query.py         # /query (AI chat, TTS, chat sessions)
│       │   └── reports.py       # /reports/upload, /reports/{id}/confirm
│       └── services/
│           ├── auth.py          # JWT creation/verification, bcrypt hashing
│           ├── safety.py        # Clinical safety evaluation (ASCVD, DDI, BP, GFR)
│           ├── retrieval.py     # Multi-tier context retrieval (Redis/Qdrant/Postgres)
│           ├── context.py       # MedGemma prompt assembler
│           ├── session.py       # Multi-turn dialog session management
│           ├── classifier.py    # Symptom classifier + embedding model
│           ├── cache.py         # Semantic response cache (Qdrant)
│           ├── llm.py           # MedGemma Kafka client (request-reply)
│           ├── report_ingestion.py  # PDF/image OCR + LLM extraction pipeline
│           ├── tts.py           # ElevenLabs TTS API wrapper
│           ├── translation.py   # Language detection + translation
│           ├── pdf.py           # Health Passport HTML generator
│           ├── ocr.py           # Tesseract/vision OCR wrapper
│           ├── rules.py         # Clinical rule engine
│           ├── events.py        # WebSocket event broadcaster
│           ├── spatial.py       # Haversine distance for hospital proximity
│           └── audit_consumer.py  # Kafka audit log consumer
│
├── medgemma-service/            # Standalone MedGemma inference microservice
│   ├── main.py                  # FastAPI entry for the inference service
│   ├── schemas.py               # Request/response schemas
│   └── utils.py                 # Model loading utilities
│
└── frontend/                    # Next.js 14 frontend
    ├── public/                  # Static SVG assets (favicon, hero images)
    └── src/
        ├── app/                 # App Router pages
        │   ├── layout.jsx       # Root layout — nav, theme toggle, toast system
        │   ├── page.jsx         # Landing page
        │   ├── login/           # Login page
        │   ├── signup/          # Signup / registration page
        │   ├── dashboard/       # Patient dashboard page
        │   ├── vitals/          # Vitals logging page
        │   ├── chat/            # AI assistant page
        │   ├── history/         # Medical history & chat sessions page
        │   ├── reports/         # Lab report scanner page
        │   ├── profile/         # Patient profile page
        │   └── clinician/       # Clinician triage + patient records pages
        ├── components/          # Reusable React components
        ├── context/
        │   └── AppContext.jsx   # Global state (auth, profile, chat, theme)
        ├── services/
        │   └── api.js           # API helpers: apiCall, apiCallBlob, compressFile
        └── styles/
            └── globals.css      # Full design system (dark/light theme CSS variables)
```

---

## Tech Stack

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| **API Framework** | FastAPI 0.111 (Python 3.11) | Async HTTP API with automatic OpenAPI docs |
| **ORM** | SQLAlchemy (async) + asyncpg | Async PostgreSQL access |
| **Primary DB** | PostgreSQL 15 + pgvector | Relational data + 768-dim embedding storage |
| **Cache / Sessions** | Redis 7 | L1 vitals cache, OTP store, rate limiting, session dialog state |
| **Vector DB** | Qdrant | Semantic similarity search for patient history retrieval |
| **Message Broker** | Apache Kafka | Async audit logging, MedGemma request-reply inference |
| **LLM** | Google MedGemma 2 (via Gemini API) | Clinical reasoning and response generation |
| **TTS** | ElevenLabs API | High-quality neural voice synthesis |
| **Auth** | JWT (python-jose) + bcrypt | Stateless authentication, password hashing |
| **Real-time** | FastAPI WebSockets | Emergency SOS live dashboard updates |
| **Tunnel** | Cloudflare Tunnel | Secure remote backend access |

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | SSR/CSR hybrid React application |
| **UI** | React 18, Vanilla CSS | Component-based UI, zero CSS framework dependencies |
| **Charts** | Chart.js + react-chartjs-2 | Vitals trend line charts |
| **Speech Input** | Web Speech API (SpeechRecognition) | Browser-native speech-to-text |
| **Fonts** | Google Fonts — Inter + Outfit | Professional typography |
| **State** | React Context API | Global app state (auth, theme, chat, vitals) |
| **Theme** | CSS custom properties (data-theme) | Dark / Light mode with localStorage persistence |

---

## Backend

### Infrastructure & Databases

#### PostgreSQL + pgvector

The primary relational store. The `pgvector` extension enables native vector storage for semantic embeddings directly in PostgreSQL — avoiding the need for a separate embedding database for warm-tier history queries.

**Composite indexes** on high-frequency query patterns:
```sql
idx_vitals_patient_recorded   ON vitals(patient_id, recorded_at)
idx_reports_patient_created   ON reports(patient_id, created_at)
idx_history_patient_created   ON patient_histories(patient_id, created_at)
idx_escalations_patient_created ON clinician_escalations(patient_id, created_at)
```

#### Redis (3-tier caching)

| Tier | Key | TTL | Content |
|---|---|---|---|
| **L1 Hot** | `hot_vitals:{patient_id}` | — | 5 most recent vital readings |
| **Rate Limit** | `ratelimit:{identifier}:{window}` | 60 s | Request count per user/IP |
| **OTP** | `patient_access_otp:{code}` | 60 s | Patient ID for clinician OTP access |
| **PDF Cache** | `pdf_passport:{patient_id}` | 600 s | Generated HTML health passport |
| **Dialog State** | `session:{patient_id}:{session_id}` | — | Multi-turn conversation context |

#### Qdrant (Semantic Vector Search)

Per-patient collection `patient_kb_{patient_id}` stores 768-dimensional embeddings of all query-response pairs and report summaries. Used for:
- **Semantic cache lookup** — if a near-identical question was answered before, return cached response instantly
- **Context retrieval** — pull the most semantically relevant prior history entries for MedGemma context assembly

#### Kafka (Async Messaging)

Two topics:
- `audit_log` — fire-and-forget audit events (queries, clinician updates, emergency accepts)
- `medgemma_requests` / `medgemma_responses` — request-reply pattern for LLM inference decoupling; the main API thread publishes a request and awaits a correlated response from the MedGemma worker, preventing thread starvation on long inference calls

### API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create patient or clinician account |
| `POST` | `/auth/login` | Public | Authenticate and receive JWT |
| `GET` | `/patient/{id}/profile` | Patient/Clinician | Fetch baseline intake profile |
| `POST` | `/patient/{id}/profile` | Patient | Create or update baseline profile |
| `POST` | `/patient/{id}/vitals` | Patient | Log new vital reading |
| `GET` | `/patient/{id}/history` | Patient/Clinician | Fetch all vitals, reports, inferences |
| `GET` | `/patient/{id}/indicators` | Patient/Clinician | Get computed clinical risk indicators |
| `GET` | `/patient/{id}/vitals/timeline` | Patient/Clinician | Chronological vitals for charting |
| `GET` | `/patient/{id}/export-pdf` | Patient/Clinician | Generate HTML health passport |
| `POST` | `/patient/{id}/emergency` | Patient | Trigger GPS SOS broadcast |
| `GET` | `/patient/{id}/emergency/active` | Patient | Poll active SOS status |
| `POST` | `/patient/{id}/emergency/cancel` | Patient | Cancel pending SOS |
| `POST` | `/patient/access-code/generate` | Patient | Generate 60-second OTP for clinician |
| `GET` | `/patient/hospitals/nearby` | Patient/Clinician | Find nearest hospitals (OSM + fallback) |
| `POST` | `/query` | Patient | Submit clinical AI query |
| `POST` | `/query/tts` | Patient | Generate TTS audio (ElevenLabs) |
| `GET` | `/query/sessions` | Patient | List saved chat sessions |
| `GET` | `/query/sessions/{id}` | Patient | Load a past chat session |
| `DELETE` | `/query/sessions/{id}` | Patient | Delete a chat session |
| `POST` | `/reports/upload` | Patient | Upload and OCR a lab report |
| `POST` | `/reports/{id}/confirm` | Patient | Confirm or correct extracted values |
| `GET` | `/clinician/escalations` | Clinician | Fetch pending triage escalations |
| `POST` | `/clinician/escalations/{id}/resolve` | Clinician | Resolve a triage escalation |
| `POST` | `/clinician/patient-history` | Clinician | Access patient records via OTP |
| `POST` | `/clinician/patient-history/update` | Clinician | Update medications/operations via OTP |
| `GET` | `/clinician/emergencies` | Clinician | List active SOS beacons |
| `POST` | `/clinician/emergencies/{id}/accept` | Clinician | Accept an emergency dispatch |
| `WS` | `/clinician/ws/emergencies` | Clinician | Live WebSocket emergency feed |

### Service Layer

#### `safety.py` — Clinical Safety Evaluation

The **deterministic safety layer** runs before every LLM call to compute:
- **ASCVD 10-year risk score** (Pooled Cohort Equations — ACC/AHA 2013 guideline)
- **Blood pressure classification** (JNC8 / ACC/AHA 2017 stages)
- **Diabetes risk** (ADA categories based on BMI, FBG, HbA1c proxies)
- **Kidney GFR stage** (CKD-EPI formula from creatinine, age, gender)
- **Drug-Drug Interaction (DDI) checker** — rule-based check on active medication list
- **Escalation flag** — triggers automatic clinician alert when safety thresholds are exceeded

#### `retrieval.py` — Multi-Tier Context Retrieval

Runs three parallel lookups:
1. **L1 — Redis hot cache**: Last 5 vitals (sub-millisecond)
2. **L2 — Qdrant semantic search**: 5 most semantically relevant history entries (vector cosine similarity)
3. **L3 — PostgreSQL warm store**: Last 5 lab reports + last 10 inferences

All three run concurrently with `asyncio.gather` to minimise latency before prompt assembly.

#### `session.py` — Multi-Turn Dialog Manager

Maintains conversational context across clarification turns. The assistant uses a structured **slot-filling** approach:
- Required slots: `body_part`, `symptom`, `duration`, `severity`
- Until all slots are filled, the assistant asks targeted follow-up questions
- Once complete (or urgency is detected), the full enriched query passes to MedGemma

#### `report_ingestion.py` — Lab Report Pipeline

```
Upload (PDF/Image)
        │
        ├─► PDF? → extract text with PyMuPDF
        ├─► Image? → Tesseract OCR
        │
        ▼
LLM extraction pass (MedGemma structured prompt)
        │
        ▼
Clinical range validation (check_ranges)
        │
        ▼
Severity tier assignment (critical / important / can_ignore)
        │
        ▼
Store in reports table → return to frontend for patient confirmation
        │
        ▼
On patient confirm → commit vitals to Postgres + index to Qdrant
```

#### `translation.py` — Multilingual Support

Detects the patient's query language and translates it to English for internal clinical processing. The MedGemma response is then translated back to the detected language before delivery, making the assistant accessible to non-English speaking patients.

#### `tts.py` — ElevenLabs Text-to-Speech

Streams neural audio from the ElevenLabs API with a configurable voice model. The backend proxies the TTS request so the API key is never exposed to the browser.

### Data Models

| Model | Table | Key Fields |
|---|---|---|
| `Patient` | `patients` | UUID, email (unique), role, facility_name, lat/lon |
| `PatientProfile` | `patient_profiles` | age, gender, race, BMI inputs, medications (JSON), allergies (JSON), lifestyle flags |
| `Vital` | `vitals` | systolic/diastolic BP, blood_sugar, creatinine, heart_rate, weight, water_intake_ml, sleep_hours |
| `Report` | `reports` | file_name, extracted_values (JSON), confidence, severity_tier, status |
| `PatientHistory` | `patient_histories` | content_type, text_content, **embedding (Vector 768)** |
| `ClinicianEscalation` | `clinician_escalations` | reason, severity_tier, status, resolved_at |
| `EmergencyAlert` | `emergency_alerts` | lat/lon, status, accepted_by_hospital, accepted_by_phone |
| `ChatSession` | `chat_sessions` | patient_id, title, timestamps |
| `ChatMessage` | `chat_messages` | session_id, role (user/assistant), content, html_content |

### Key Backend Optimizations

| Optimization | Implementation |
|---|---|
| **Redis L1 vitals cache** | Latest 5 vitals hot-cached in Redis; invalidated on new vital write |
| **Semantic response cache** | Qdrant cosine similarity lookup before every LLM call; prevents redundant inference for similar queries |
| **Async parallel retrieval** | `asyncio.gather` runs Redis + Qdrant + PostgreSQL lookups concurrently |
| **Kafka request-reply** | LLM inference decoupled from API thread pool; prevents timeout cascades |
| **Redis PDF cache** | Health Passport HTML cached for 10 minutes; avoids re-generating on every export |
| **Per-user rate limiting** | JWT-aware rate limiter (falls back to IP); 429 on abuse, bypasses health/docs endpoints |
| **pgvector composite index** | `(patient_id, recorded_at)` composite indexes on all time-series tables |
| **Async SQLAlchemy** | All DB operations are non-blocking; FastAPI event loop never stalls on I/O |
| **Single-use OTP** | Redis OTP key deleted immediately on first clinician read (privacy guarantee) |

---

## MedGemma Inference Service

A standalone microservice at `medgemma-service/` that:
- Runs as an independent process (can be deployed on a GPU machine)
- Consumes `medgemma_requests` from Kafka
- Runs inference via Google Gemini API (MedGemma model)
- Publishes responses to `medgemma_responses` with correlation IDs

This decoupling means:
- The main API server is never blocked by slow LLM calls
- The inference worker can scale independently
- LLM can be swapped to a local model without touching the API layer

---

## Frontend

### Pages & Routing

| Route | Component | Access |
|---|---|---|
| `/` | `page.jsx` | Public — Landing page |
| `/login` | `login/page.jsx` | Public — Login |
| `/signup` | `signup/page.jsx` | Public — Registration |
| `/dashboard` | `PatientDashboard` | Patient |
| `/vitals` | `PatientVitalsForm` + `PatientProfileForm` | Patient |
| `/chat` | `ChatAssistant` | Patient |
| `/history` | `MedicalHistory` | Patient |
| `/reports` | `LabReports` | Patient |
| `/profile` | `PatientProfileForm` | Patient |
| `/clinician` | `ClinicianDashboard` | Clinician |
| `/clinician/records` | `ClinicianRecords` | Clinician |

### Components

| Component | Responsibility |
|---|---|
| `ChatAssistant.jsx` | Multi-turn AI chat, voice mode (STT/TTS), chat history drawer, session management, 60-second processing banner |
| `PatientDashboard.jsx` | Clinical risk indicator cards, lifestyle quick-stat cards (weight/hydration/sleep), SOS dispatch, OTP generator, hospital locator |
| `VitalsTimeline.jsx` | Interactive Chart.js line charts with tab-based selector (Clinical vitals ↔ Lifestyle metrics) |
| `PatientVitalsForm.jsx` | Vital logging form (BP, sugar, heart rate, creatinine, weight, hydration, sleep) |
| `PatientProfileForm.jsx` | Baseline intake profile form (demographics, medications, allergies, lifestyle) |
| `LabReports.jsx` | Drag-and-drop file upload with client-side compression, extraction preview, patient value correction |
| `MedicalHistory.jsx` | Tabbed history viewer (vitals, lab reports, AI inferences, chat sessions) |
| `ClinicianDashboard.jsx` | Triage escalation queue, live emergency WebSocket feed, accept dispatch |
| `ClinicianRecords.jsx` | OTP-gated patient record access, medication and operations updates |

### State Management

All global state lives in `AppContext.jsx` (React Context + `useReducer`-style hooks):

```
AppContext provides:
├── Auth: token, role, userId, email, saveSession(), logout()
├── Patient Data: profile, indicators, historyData, timeline
├── Chat: chatMessages, chatAlerts, currentSessionId
├── SOS: activeSos
├── Clinician: escalations, sosBeacons, retrievedPatient
├── UI: toast (showToast), theme, toggleTheme
└── Actions: fetchProfile, fetchIndicators, fetchHistory,
             fetchTimeline, checkActiveSos, fetchEscalations,
             fetchEmergencies
```

**Persistence strategy:**
- `localStorage`: JWT token, role, user ID, email, theme preference (`swasthyasetu_*`)
- `sessionStorage`: Active chat messages and alerts (cleared on logout)

### Key Frontend Optimizations

| Optimization | Implementation |
|---|---|
| **Client-side image compression** | `compressFile()` in `api.js` — Canvas API resize to ≤1920px + JPEG re-encode at 85% quality before upload (40–70% size reduction) |
| **PDF pass-through** | PDFs skipped in compression (already zlib-compressed internally) |
| **Semantic caching (proxy)** | Backend Qdrant cache means identical queries return instantly; frontend benefits transparently |
| **SessionStorage chat cache** | Chat messages survive tab switches without re-fetching from server |
| **Lazy data fetching** | `fetchProfile`, `fetchIndicators`, etc. only called when `userId` is available; no redundant startup requests |
| **Theme persistence** | `data-theme` attribute applied to `<html>` element on first mount from `localStorage`; no flash of wrong theme |
| **60-second slow query UX** | Timer-based fallback banner informs users when MedGemma is under load, preventing frustrating silent waits |
| **Lifestyle quick-stat cards** | Read directly from cached `timeline` array — zero additional API calls |
| **Chart metric tabs** | React state switch between dataset groups; single Chart.js instance, no re-mount |
| **Static SVG assets** | All illustration assets are vector SVGs in `/public` — served by Next.js CDN, no external image dependencies |

---

## Clinical Features

### ASCVD 10-Year Risk Score
Implements the **ACC/AHA 2013 Pooled Cohort Equations** using:
- Age, gender, race
- Total cholesterol (proxied from profile), HDL
- Systolic BP, BP treatment status
- Smoking status, diabetes status

Risk categories: Normal (<7.5%), Borderline (7.5–10%), Intermediate (10–20%), High (≥20%)

### Blood Pressure Classification (ACC/AHA 2017)
- Normal: <120/80
- Elevated: 120–129 systolic, <80 diastolic
- Stage 1 Hypertension: 130–139 / 80–89
- Stage 2 Hypertension: ≥140 / ≥90
- Hypertensive Crisis: >180 / >120

### Kidney GFR Stage (CKD-EPI)
Calculated from creatinine, age, gender (female correction factor). Maps to CKD stages G1–G5.

### Diabetes Risk Classification (ADA)
- Normal: FBG < 100 mg/dL
- Pre-diabetes: FBG 100–125 mg/dL
- Type 2 Diabetes: FBG ≥ 126 mg/dL (with BMI context)

### Drug-Drug Interaction Checker
Rule-based engine cross-references the patient's active medication list against a curated interaction table (e.g., warfarin + aspirin, ACE inhibitor + potassium-sparing diuretic). Triggers escalation alert to clinician queue when a critical DDI is detected.

---

## Security & Privacy

| Concern | Implementation |
|---|---|
| **Authentication** | JWT Bearer tokens (HS256), stored in `localStorage` only |
| **Password storage** | bcrypt hashing via `passlib` |
| **Role enforcement** | `RoleChecker` dependency on every protected route; patients cannot access clinician endpoints |
| **Patient data isolation** | `verify_self_or_clinician()` guard on all patient routes — patients can only read/write their own data |
| **OTP access** | Single-use 60-second OTP stored in Redis; consumed immediately on first read |
| **API key security** | ElevenLabs + Gemini API keys stored server-side only; never exposed to browser |
| **CORS** | Strict allow-list (localhost:3000, localhost:8000) in production |
| **Rate limiting** | Per-user (JWT-aware) rate limiting via Redis sliding window — 429 on exceeding limit |
| **Input validation** | Pydantic v2 schemas on all request bodies; type-safe at API boundary |
| **Audit logging** | Every clinician access, record update, and emergency accept written to Kafka audit log |

---

## Running the Project

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15 with pgvector extension
- Redis 7
- Qdrant (local or cloud)
- Apache Kafka + Zookeeper
- Cloudflare CLI (`cloudflared`) — for remote tunnel

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set environment variables (see below)

# Run backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### MedGemma Inference Service

```bash
cd medgemma-service

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend

npm install
npm run dev
# Runs on http://localhost:3000
```

### Cloudflare Tunnel (for cross-device development)

```bash
# On the backend machine
cloudflared tunnel run <your-tunnel-name>

# Update frontend/src/services/api.js:
export const API_BASE = "https://your-tunnel-name.trycloudflare.com";
```

> **Tip:** Use a named tunnel (`cloudflared tunnel create swasthyasetu`) instead of Quick Tunnel to get a stable, persistent URL.

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/swasthyasetu

# Redis
REDIS_URL=redis://localhost:6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Security
JWT_SECRET=your-jwt-secret-key-minimum-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# APIs
GOOGLE_API_KEY=your-gemini-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=your-voice-id

# Rate Limiting
RATE_LIMIT_PER_MIN=60
```

---

## API Reference Summary

Full interactive API documentation is available at:
```
http://localhost:8000/docs        # Swagger UI
http://localhost:8000/redoc       # ReDoc
http://localhost:8000/openapi.json  # Raw OpenAPI spec
```

### Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

Tokens are obtained from `/auth/login` or `/auth/register` and stored client-side in `localStorage` under the key `swasthyasetu_token`.

### Response Format

All JSON responses follow FastAPI defaults. Errors return:
```json
{
  "detail": "Human-readable error message"
}
```

HTTP status codes used:
- `200 OK` — successful retrieval
- `201 Created` — successful creation
- `400 Bad Request` — validation / business logic error
- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — role mismatch or OTP invalid
- `404 Not Found` — resource not found
- `422 Unprocessable Entity` — request body schema error
- `429 Too Many Requests` — rate limit exceeded
- `500 Internal Server Error` — unexpected server fault

---

## Contributors

Built for **Tetrathon 2026** — TETRA006 submission.

---

*SwasthyaSetu is a clinical decision support tool intended for informational purposes. It is not a substitute for professional medical advice, diagnosis, or treatment.*
