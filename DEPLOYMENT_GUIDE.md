# Instructions for Deploying Web Scraper

## Step 1: Set up the Cloud Database (Neon.tech)

1. Go to [https://neon.tech](https://neon.tech) and sign up (Free).
2. Click **Create Project** (Name: `web-scraper`).
3. Under **Connection Details**, copy the connection string (starts with `postgresql://...`).
4. Save this string — you will paste it into Render in Step 2.

---

## Step 2: Deploy Backend on Render

1. Go to [https://render.com](https://render.com) and log in with your GitHub account.
2. Click **New +** -> **Web Service**.
3. Select your GitHub repository (`Web-Scraper`).
4. In the setup settings:
   - **Name**: `web-scraper-api` (or any name you prefer)
   - **Root Directory**: `backend`
   - **Runtime**: **Docker** (Render will automatically detect `backend/Dockerfile`)
   - **Instance Type**: **Free**
5. Under **Environment Variables**, click **Add Environment Variable**:
   - `PG_DSN` = `[paste your Neon.tech connection string here]`
   - `SECRET_KEY` = `[any random secret string, e.g. scraper-prod-secret-99]`
6. Click **Deploy Web Service**.
7. Once deployed, Render gives you a live URL, like:
   `https://web-scraper-api.onrender.com`

---

## Step 3: Deploy Frontend on Vercel

1. Go to [https://vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository (`Web-Scraper`).
4. In the configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `scraper-ui`
5. Expand **Environment Variables**:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://web-scraper-api.onrender.com` (your Render backend URL from Step 2 without a trailing slash)
6. Click **Deploy**.
7. In ~1 minute, Vercel gives you your production URL:
   `https://web-scraper-ui.vercel.app`

---

## Step 4: Add to Your Portfolio
In your portfolio / resume:
- **Live Demo Link**: `https://web-scraper-ui.vercel.app`
- **Tech Stack**: React 18, Vite, Tailwind CSS, Python (Flask), Playwright, PostgreSQL (Neon), Docker, Deployed on Vercel & Render.
