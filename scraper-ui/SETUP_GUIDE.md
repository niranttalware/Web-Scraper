# Web Scraper Platform - Setup Guide

Follow this guide to easily set up and run the Web Scraper application on any new laptop or computer.

---

## 📌 1. System Requirements
Before starting, ensure the following software is installed on your new machine:
1. **Node.js (v20 or higher)**: Required for the React frontend.
   - Download: [nodejs.org](https://nodejs.org/) (Choose the LTS version)
2. **Python (v3.10 or higher)**: Required for the backend.
   - Download: [python.org](https://www.python.org/downloads/)
3. **PostgreSQL**: Required for the database (user accounts & scraping history).
   - Download: [EnterpriseDB PostgreSQL Installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
   - *Note: Remember the superuser password you create during installation! (Recommended: `postgres`)*

---

## 🗄️ 2. Database Configuration
Once PostgreSQL is installed:
1. Open **pgAdmin 4** (installed alongside PostgreSQL).
2. Enter your master password.
3. On the left sidebar, expand **Servers** -> **PostgreSQL**.
4. Right-click on **Databases**, select **Create** -> **Database...**
5. Name the database exactly: **`web_scraper`**
6. Click **Save**.

---

## ⚙️ 3. Backend Setup (Python)

1. Open your terminal or command prompt and navigate to the `backend` folder:
   ```powershell
   cd path\to\Web-Scraper\backend
   ```

2. **Configure Environment Variables**:
   Create a file named `.env` inside the `backend` folder and add the following:
   ```env
   PG_HOST=localhost
   PG_PORT=5432
   PG_DB=web_scraper
   PG_USER=postgres
   PG_PASSWORD=postgres   # Change this if you used a different password during PostgreSQL install
   SECRET_KEY=my-super-secret-jwt-key
   ```

3. **Create & Activate Virtual Environment**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

4. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   playwright install
   ```

5. **Start the Server**:
   ```powershell
   python app.py
   ```
   *The backend automatically runs all database migrations and creates the default user account (`Test@gmail.com` / `Test@123`).*

---

## 🎨 4. Frontend Setup (React)

1. Open a **new** terminal and navigate to the `scraper-ui` folder:
   ```powershell
   cd path\to\Web-Scraper\scraper-ui
   ```

2. **Install Node Dependencies**:
   ```powershell
   npm install
   ```

3. **Start the Frontend**:
   ```powershell
   npm run dev
   ```

---

## 🎉 5. Login & Verification
Open your browser at `http://localhost:5173`.

1. **Log in with Default User**:
   - **Email**: `Test@gmail.com`
   - **Password**: `Test@123`
2. **Or Click Register** to create any new user account.
3. Your application is now fully running and ready to scrape!
