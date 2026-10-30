# Akshanet — Demo Walkthrough

Step-by-step guide for judges evaluating SIH26263 (AICTE / Smart Automation).

## Prerequisites

- Docker Desktop running
- Git, Node.js 18+, pnpm 9+

## 1. Start All Services

```bash
git clone <repo-url> && cd akshanet
cp .env.example .env
docker compose up --build
```

Wait until all 8 services are healthy (~2 minutes on first build).

| Service              | URL                    | Role              |
| -------------------- | ---------------------- | ----------------- |
| Institution Portal   | http://localhost:3001   | Institution admin |
| Student PWA          | http://localhost:3002   | Student           |
| AICTE Dashboard      | http://localhost:3003   | AICTE officer     |
| Employer Portal      | http://localhost:3004   | Employer          |
| API                  | http://localhost:3001/api/v1/health | Backend  |

## 2. Seed Demo Data

```bash
docker compose exec api npx prisma db seed
```

This creates 4 demo users and sample admission records.

### Demo Credentials

| Role              | Email                     | OTP    |
| ----------------- | ------------------------- | ------ |
| Institution Admin | admin@demo-inst.ac.in     | 000000 |
| Student           | student@demo.in           | 000000 |
| AICTE Officer     | officer@aicte.gov.in      | 000000 |
| Employer          | hr@demo-corp.com          | 000000 |

## 3. Demo Flow — Institution Portal (http://localhost:3001)

### 3a. Login
1. Enter `admin@demo-inst.ac.in` → click **Send OTP**
2. Enter `000000` → click **Verify**
3. **Expected**: Redirected to Dashboard with KPI cards

### 3b. Upload Student CSV
1. Click **Upload** in sidebar
2. Drag-and-drop `test/fixtures/sample.csv` (or click to browse)
3. **Expected**: Preview table shows 5 student rows
4. Click **Upload** → redirected to Column Mapper

### 3c. Column Mapping
1. Columns auto-detected (green checkmarks)
2. Click **Confirm Mapping**
3. **Expected**: Success toast — "5 created, 0 skipped, 0 failed"

<!-- Screenshot: column-mapper-success.png -->

### 3d. View Records
1. Click **Dashboard** → see updated KPI numbers
2. Click a submission row → paginated Records table
3. Filter by status: `submitted`, `apaar_verified`, etc.

### 3e. Submit to AICTE
1. On a record with status `student_verified`, click **Submit to AICTE**
2. Confirm in dialog
3. **Expected**: Status changes to `submitted_to_aicte`

## 4. Demo Flow — Student PWA (http://localhost:3002)

### 4a. Login
1. Enter APAAR ID `123456789012` → **Send OTP** → enter `000000`
2. **Expected**: Home page with welcome card

### 4b. View Record
1. Tap **My Record** in bottom nav
2. **Expected**: Personal, Academic, Verification cards with field values

### 4c. Approve Employer Consent
1. Tap **Consents** in bottom nav
2. **Expected**: Pending consent request from employer
3. Tap **Approve**
4. **Expected**: Status changes to "Approved"

<!-- Screenshot: student-consent-approve.png -->

## 5. Demo Flow — Employer Portal (http://localhost:3004)

### 5a. Login
1. Enter `hr@demo-corp.com` → **Send OTP** → `000000`
2. **Expected**: Dashboard with 4 KPI tiles

### 5b. Search Student
1. Click **Student Search** → enter `123456789012`
2. **Expected**: Student card with name, programme, institution (limited fields only — no Aadhaar)

### 5c. Request Consent
1. Click **Request Consent**
2. Fill: APAAR ID `123456789012`, Purpose: "Employment Verification", Expiry: future date
3. Click **Submit Request**
4. **Expected**: Success toast, request appears in Consent History

### 5d. Consent History
1. Click **Consent History**
2. **Expected**: Table with the request, status `pending`
3. Filter by status, export CSV

## 6. Demo Flow — AICTE Dashboard (http://localhost:3003)

### 6a. Login
1. Enter `officer@aicte.gov.in` → **Send OTP** → `000000`
2. **Expected**: National Overview with KPI tiles, trend chart, state-wise bar chart

### 6b. Anomaly Monitoring
1. Click **Anomalies** in sidebar
2. **Expected**: Table of flagged records with type/state filters
3. Select rows → **Escalate Selected**

<!-- Screenshot: aicte-anomalies.png -->

### 6c. Approve Records
1. Click **Approvals** in sidebar
2. Click an institution row to expand
3. **Expected**: APH checklist (5 items with check/cross icons)
4. Click **Approve** or **Reject** (with reason codes)

### 6d. Generate Letter
1. Click **Letters** → select an approved institution
2. Click **Generate Letter**
3. **Expected**: PDF preview in dialog, download link

### 6e. Generate Report
1. Click **Reports** → select type (Admission Summary), format (PDF), date range
2. Click **Generate**
3. **Expected**: Progress indicator → download badge when ready

## 7. Verify Integration

```bash
# Run smoke tests
pnpm test:smoke

# Run full API test suite
pnpm --filter api test
```

**Expected**: 229+ tests passing, 0 failures.

## Architecture Summary

```
Browser → Nginx (3001-3004) → API (Express 5) → Postgres + Redis + MinIO
                                  ↓
                            ML Service (FastAPI)
                                  ↓
                          Anomaly Scoring Engine
```

**Key Innovation**: APAAR ID as primary key for every student record, enabling cross-institution deduplication, fraud detection via ML anomaly scoring, and consent-based employer verification — all within AICTE's regulatory framework.
