# Winjit Web Scraper

## Overview
**Winjit Web Scraper** is a powerful, full-stack web scraping platform designed to intelligently crawl websites, extract structured data, and provide a beautiful, user-friendly interface to manage and inspect your scraping jobs. 

It is built to handle both simple targeted scraping and deep, site-wide crawls, extracting data into clean formats (like Markdown) that are perfect for human reading, archival, or feeding into AI/LLM pipelines.

---

## Key Features

### 1. Dual Scraping Modes
* **Full Crawl:** Enter a single starting URL (like a homepage). The system will first perform a deep "URL Discovery" phase to find every internal link on the website. You can then review the discovered URLs and proceed to scrape the entire site.
* **Targeted URLs:** Have a specific list of pages you care about? Paste your custom list of URLs, and the scraper will bypass discovery and extract exactly what you asked for.

### 2. Comprehensive Data Extraction
For every page scraped, the engine automatically extracts and saves:
* **Structured Markdown (`content.md`):** Clean, readable text with headings, lists, and links preserved.
* **Raw HTML (`content.html`):** The complete DOM structure of the page.
* **Images:** Automatically downloads and saves all images, icons found on the page.
* **JSON Metadata:** Preserves page structure, meta descriptions, and titles.

### 3. History Vault & Inspectors
Never lose a scrape. The built-in History Vault tracks all your activity:
* **URL Inspector:** View exactly which URLs were discovered, separating them into "Working" and "Non-Working" lists.
* **Data Inspector:** A rich preview window allowing you to read the scraped Markdown, HTML or Json directly in the browser without downloading anything.
* **Export Options:** Download a ZIP file containing the perfectly organized folder structure of your scraped data, or download an Excel/CSV list of all discovered URLs.
* **1-Click Re-run:** Easily run previous jobs again with exactly the same parameters.

---

## Technology Stack

### Frontend (User Interface)
* **React & Vite:** Lightning-fast frontend framework for a smooth single-page application experience.
* **Tailwind CSS:** Powers the premium, modern, responsive, and dark-mode-ready visual aesthetics.

### Backend (Server & Orchestration)
* **Python & Flask:** A lightweight API server that handles frontend requests, manages job states, and streams real-time logs to the UI.
* **Job Manager:** A custom background orchestrator that runs heavy scraping tasks asynchronously, manages ZIP compression, and saves history.

### Scraping Engine (The Core Scripts)
The heavy lifting is done by two entirely decoupled, standalone Python scripts:
* **`url_finder.py`:** Uses intelligent crawling to map out a domain's internal links, skipping unwanted file types and external domains.
* **`web_scraper.py`:** Uses **Playwright** (for full JavaScript rendering capability) and **BeautifulSoup4** to extract DOM content safely and reliably, even on modern interactive web apps.

---

## Folder Structure

When data is scraped and downloaded (via ZIP), it follows a strict, highly organized structure:
```text
[Website Name]/
└── pages/
    ├── page_1/
    │   ├── content.md
    │   ├── content.html
    │   ├── structure.json
    │   └── images/
    │       ├── img1.png
    │       └── img2.jpg
    └── page_2/
        ├── content.md
        └── ...
```

---

## Standalone Execution (No UI Required)
The scraping engine was designed with a decoupled architecture. If developers wish to run the scrapers without the React UI or Flask backend, they can do so directly from their terminal:

1. **Install Dependencies:**
   ```bash
   pip install requests beautifulsoup4 playwright
   playwright install
   ```
2. **Find URLs:**
   ```bash
   python backend/script/url_finder.py https://example.com --out urls.txt
   ```
3. **Scrape Data:**
   ```bash
   python backend/script/web_scraper.py urls.txt --name "Output Data"
   ```

---

*This documentation is meant to be a living document. Feel free to edit and expand it as the application grows!*
