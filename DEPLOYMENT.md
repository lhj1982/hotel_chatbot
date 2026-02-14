# Deployment Guide — Hotel AI Chatbot

Deploy the full stack using Vercel (frontends) + Railway (backend) + managed services.

## Architecture Overview

```
Vercel                          Railway                    Managed Services
┌──────────────┐               ┌──────────────┐           ┌─────────────┐
│ hotel-admin  │──API proxy──▶│  FastAPI API  │──────────▶│ Neon (PG)   │
│ (Next.js)    │               │  :8000       │           │ + pgvector  │
└──────────────┘               ├──────────────┤           ├─────────────┤
┌──────────────┐               │ Celery Worker│──────────▶│ Upstash     │
│ hotel-frontend│               │  (background)│           │ (Redis)     │
│ (static JS)  │               └──────────────┘           ├─────────────┤
└──────────────┘                                          │ AWS S3      │
                                                          │ (file store)│
                                                          └─────────────┘
```

## Services & Free Tiers

| Component | Service | Free Tier |
|-----------|---------|-----------|
| Database (pgvector) | Neon | 0.5GB storage |
| Redis | Upstash | 10K commands/day |
| Object Storage | AWS S3 (or Cloudflare R2) | S3: 5GB/12mo, R2: 10GB always |
| Backend API + Worker | Railway | $5/mo credit |
| Admin Dashboard | Vercel | Generous free tier |
| Chat Widget | Vercel | Static site, free |

---

## Step 1: Provision Neon (PostgreSQL + pgvector)

**Option A — Via Vercel Marketplace (easiest)**

1. Log in to https://vercel.com
2. Go to **Storage** tab (top nav)
3. Click **Create Database** → select **Neon Postgres**
   - Name: `hotel-ai-db`
   - Region: `US East (N. Virginia)` (or your preferred region)
   - Click **Create**
4. Vercel auto-injects env vars like `POSTGRES_URL` into your project
5. Click the Neon link to open the Neon dashboard
6. In Neon **SQL Editor**, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

**Option B — Direct signup**

1. Go to https://neon.tech → Sign Up
2. Create project → Region: US East → Postgres 16
3. Run `CREATE EXTENSION IF NOT EXISTS vector;` in SQL Editor

**Save the connection strings:**

From the Neon dashboard, copy the **non-pooler** connection string (toggle off "Pooled connection"). You need two versions:

```
# Async — for DATABASE_URL (replace postgresql:// with postgresql+asyncpg://)
DATABASE_URL=postgresql+asyncpg://USER:PASS@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# Sync — for DATABASE_URL_SYNC (keep as-is)
DATABASE_URL_SYNC=postgresql://USER:PASS@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

> **Important:** Use the **non-pooler** URL (no `-pooler` in hostname). The pooler endpoint can cause migrations to hang. Also do NOT include `channel_binding=require` — it causes psycopg2 to hang.

---

## Step 2: Provision Upstash (Redis)

**Option A — Via Vercel Marketplace**

1. In Vercel → **Storage** → **Create Database** → select **Upstash Redis** (KV)
2. Name: `hotel-ai-redis`, Region: `US-East-1`
3. Click **Create**

**Option B — Direct signup**

1. Go to https://upstash.com → Sign Up
2. Create Database → Regional → US-East-1

**Save the connection string:**

```
# Note: rediss:// (double s) = TLS encrypted
REDIS_URL=rediss://default:xxx@us1-xxx.upstash.io:6379
```

---

## Step 3: Provision AWS S3 (Object Storage)

> **Alternative:** Cloudflare R2 has 10GB always-free with no credit card. Use R2's S3-compatible endpoint URL with `S3_ENDPOINT_URL`.

1. Go to https://aws.amazon.com → Sign in
2. Search "S3" → **Create bucket**
   - Bucket name: `hotel-ai-kb-test` (must be globally unique)
   - Region: `US East (N. Virginia)` us-east-1
   - Leave defaults → **Create bucket**
3. Create IAM user:
   - Search "IAM" → **Users** → **Create user**
   - Name: `hotel-ai-s3`
   - Attach policy with this JSON:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
         "Resource": [
           "arn:aws:s3:::hotel-ai-kb-test",
           "arn:aws:s3:::hotel-ai-kb-test/*"
         ]
       }]
     }
     ```
4. Create access key → Save **Access Key ID** and **Secret Access Key**

---

## Step 4: Run Database Migrations

Run migrations locally against Neon before deploying:

```bash
cd hotel-ai-core

# Activate your virtualenv
source venv/bin/activate  # adjust path to your venv

# Install deps
pip install -r requirements.txt

# Run migrations (use YOUR Neon non-pooler URL)
DATABASE_URL_SYNC="postgresql://USER:PASS@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" \
  alembic upgrade head

# Seed test admin user
DATABASE_URL_SYNC="postgresql://USER:PASS@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" \
  python scripts/seed_admin.py
```

**Troubleshooting if alembic hangs:**
- Make sure you're using the **non-pooler** URL (no `-pooler` in hostname)
- Remove `channel_binding=require` from the URL
- The `.env` file is loaded by pydantic-settings — if it contains old Docker URLs, they override config.py defaults. Pass the URL as a shell env var prefix (shown above) to override `.env`
- Verify connectivity: `python -c "import psycopg2; psycopg2.connect('YOUR_URL'); print('ok')"`

Verify in Neon SQL Editor: `SELECT * FROM users;` should show your test user.

---

## Step 5: Deploy Backend to Railway

1. Go to https://railway.app → **Sign Up** (GitHub recommended)
2. Click **New Project** → **Deploy from GitHub repo** → select your repo

### API Service

3. Click the service → **Settings**:
   - **Root Directory**: `hotel-ai-core`
   - **Builder**: Dockerfile
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`

4. Go to **Variables** → **Raw Editor** → paste:
   ```
   DATABASE_URL=postgresql+asyncpg://USER:PASS@ep-xxx.neon.tech/neondb?sslmode=require
   DATABASE_URL_SYNC=postgresql://USER:PASS@ep-xxx.neon.tech/neondb?sslmode=require
   REDIS_URL=rediss://default:xxx@us1-xxx.upstash.io:6379
   JWT_SECRET_KEY=<run: openssl rand -hex 32>
   JWT_ALGORITHM=HS256
   JWT_EXPIRATION_MINUTES=60
   OPENAI_API_KEY=sk-xxx
   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
   OPENAI_CHAT_MODEL=gpt-4o-mini
   RAG_TOP_K=8
   RAG_CONFIDENCE_THRESHOLD=0.30
   S3_ENDPOINT_URL=
   S3_ACCESS_KEY=<your-aws-access-key>
   S3_SECRET_KEY=<your-aws-secret-key>
   S3_BUCKET_NAME=hotel-ai-kb-test
   S3_REGION=us-east-1
   APP_ENV=staging
   LOG_LEVEL=INFO
   CORS_ORIGINS=["http://localhost:3000"]
   ```

5. Go to **Networking** → **Generate Domain** → copy URL (e.g., `hotel-ai-core-xxx.up.railway.app`)

### Worker Service

6. In the same project: **+ New** → **GitHub Repo** → same repo
7. **Settings**:
   - Root Directory: `hotel-ai-core`
   - Start Command: `celery -A app.workers.celery_app worker --loglevel=info --concurrency=2`
8. **Variables**: Same as API service
9. **Networking**: No public domain needed

### Verify

Visit `https://your-railway-url.up.railway.app/docs` — should show FastAPI Swagger docs.

---

## Step 6: Deploy Admin Dashboard to Vercel

1. Go to https://vercel.com → **Add New** → **Project**
2. Import your GitHub repo
3. Configure:
   - **Project Name**: `hotel-admin-web`
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: Click **Edit** → `hotel-admin-web`
4. **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `CORE_API_BASE_URL` | `https://your-railway-url.up.railway.app` |
   | `CORE_LOGIN_PATH` | `/admin/login` |
   | `AUTH_COOKIE_NAME` | `hotel_admin_access` |
   | `APP_ORIGIN` | `https://hotel-admin-web-xxx.vercel.app` (update after first deploy) |

5. Click **Deploy**
6. After deploy, note the actual URL and update `APP_ORIGIN` if needed

---

## Step 7: Deploy Chat Widget to Vercel

1. On Vercel: **Add New** → **Project** → import same repo
2. Configure:
   - **Project Name**: `hotel-frontend`
   - **Framework Preset**: **Vite** (or **Other**)
   - **Root Directory**: Click **Edit** → `hotel-frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. No environment variables needed
4. Click **Deploy**
5. Test: `https://hotel-frontend-xxx.vercel.app/chat?key=YOUR_WIDGET_KEY&api=https://your-railway-url.up.railway.app`

---

## Step 8: Update CORS on Railway

Now that you have all the Vercel URLs, update Railway env vars:

1. API service → **Variables** → update `CORS_ORIGINS`:
   ```
   CORS_ORIGINS=["https://hotel-admin-web-xxx.vercel.app","https://hotel-frontend-xxx.vercel.app"]
   ```
2. Worker service → same change
3. Railway auto-redeploys on env var changes

---

## Step 9: End-to-End Verification

1. **Admin login**: `https://hotel-admin-web-xxx.vercel.app/login` → test@test.com / test
2. **Upload document**: KB page → upload PDF or add text snippet → verify indexing
3. **Create widget key**: Settings page → Create Key → copy the `wk_xxx` key
4. **Test chat**: `https://hotel-frontend-xxx.vercel.app/chat?key=wk_xxx&api=https://your-railway-url.up.railway.app`
5. **Ask a question** about your uploaded content → verify AI response

### Embed widget on any website:
```html
<script
  src="https://hotel-frontend-xxx.vercel.app/widget.js"
  data-key="wk_xxx"
  data-api-url="https://your-railway-url.up.railway.app">
</script>
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Alembic hangs | Using pooler URL or `channel_binding=require` | Use non-pooler URL, remove channel_binding |
| Alembic hangs | `.env` overrides shell env var | Pass `DATABASE_URL_SYNC=...` as prefix to command |
| `ModuleNotFoundError: pgvector` | Not in active virtualenv | Activate venv, `pip install -r requirements.txt` |
| 401 on admin login | Wrong `CORE_API_BASE_URL` | Check Railway URL in Vercel env vars |
| CORS errors in browser | Vercel URLs not in CORS_ORIGINS | Update Railway env var with actual Vercel URLs |
| Widget can't reach API | Missing `data-api-url` | Widget infers from script src; add `data-api-url` pointing to Railway |
| Celery SSL error with Upstash | Needs TLS config | URL should start with `rediss://` (double s) |

---

## Important Security Notes

- Never commit `.env` files — ensure `.gitignore` includes `.env`
- Generate a strong JWT secret: `openssl rand -hex 32`
- The `.env` file in `hotel-ai-core/` is for local Docker development only
- For Railway/Vercel, set env vars through their dashboards
- Rotate the Neon password and API keys if they were ever committed to git
