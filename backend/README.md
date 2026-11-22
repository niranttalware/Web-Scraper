# Web Scraper Platform

A full-stack, real-time web scraping platform featuring a modern React frontend and a powerful Python backend using Playwright. 

This platform allows users to input target URLs, crawl sites up to a specific depth, download webpage content (including images), and package everything into an easy-to-download ZIP file. It includes a history vault to access past scraping jobs and features real-time terminal-like logs showing the scraping progress.

## ✨ Features

- **Modern UI:** Built with React, Vite, and TailwindCSS for a responsive, dark-mode, animated interface.
- **Real-Time Terminal:** View live logs of URL discovery and page scraping with color-coded success, skip, and error messages.
- **Deep Web Crawling:** Uses Python's `asyncio` and `playwright` to deeply crawl websites and capture rendered HTML and images.
- **Authentication:** Secure login system using JWT (JSON Web Tokens) stored in session storage.
- **History Vault:** Automatically stores previous scrape jobs for quick access and re-downloading.
- **Zip Compression:** Automatically packages the scraped data (HTML + Images) into a structured ZIP file.

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Vite
- TailwindCSS
- Lucide React (Icons)

**Backend:**
- Python 3.x
- Flask / Flask-Cors
- Playwright (Headless browser automation)
- BeautifulSoup4 (HTML parsing)
- PyJWT (Authentication)

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python](https://www.python.org/downloads/) (v3.8 or higher)

---

### 1. Backend Setup

Open a terminal and navigate to the `backend` folder:

```bash
cd backend
```

Create a virtual environment and install the dependencies:
```bash
python -m venv venv
venv\Scripts\activate   # On Windows
pip install -r requirements.txt
```

Install the Playwright browsers:
```bash
playwright install chromium
```

Start the Flask server:
```bash
python app.py
```
*The backend will run on `http://localhost:5000`.*

---

### 2. Frontend Setup

Open a new terminal and navigate to the `scraper-ui` folder:

```bash
cd scraper-ui
```

Install the dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*The frontend will run on `http://localhost:5173`.*

---

## 🔒 Default Credentials
When running locally, use the following to log in:
- **Username:** `admin`
- **Password:** `admin`

## 📁 Project Structure

```
Web_Scripping/
├── backend/
│   ├── app.py                 # Main Flask application & routes
│   ├── services/
│   │   └── job_manager.py     # Background task orchestrator for scraping
│   ├── script/
│   │   └── url_finder.py      # Playwright crawler & scraper logic
│   ├── db/
│   │   └── history.json       # JSON database for past scrapes
│   └── .env                   # Secret keys (ignored in Git)
│
└── scraper-ui/
    ├── src/
    │   ├── App.jsx            # Main React UI, Terminal, & Dashboard
    │   ├── api/
    │   │   ├── auth.js        # Auth functions
    │   │   └── client.js      # Axios client with JWT interceptors
    │   └── components/
    │       └── AuthScreen.jsx # Login screen
    └── tailwind.config.js     # Tailwind design tokens
```
