#!/usr/bin/env python3
"""
web_scraper.py — Universal Website Scraper
==========================================
Scrapes any website from a list of URLs. For each page it:
  - Downloads the HTML
  - Extracts and saves all images
  - Generates a structured Markdown file (content.md)
  - Saves the raw HTML (content.html)

Output structure:
  pages/
    <lang>/
      <section>/
        <page>/
          content.md
          content.html
          images/

Usage:
  python web_scraper.py <urls_file> [options]

  Options:
    --out <dir>         Output root directory (default: pages)
    --delay <seconds>   Delay between requests (default: 0.5)
    --retries <n>       Number of retries on failure (default: 2)
    --timeout <seconds> Request timeout (default: 20)
    --lang-detect       Auto-detect language from URL (default: on)
    --default-lang <l>  Default language when none is detected (default: en)

Examples:
  python web_scraper.py urls.txt
  python web_scraper.py urls.txt --out output --delay 1 --default-lang en
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os
import time
import re
import sys
import json
import argparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# ──────────────────────────────────────────────────────────────────────────────
# Language Detection
# ──────────────────────────────────────────────────────────────────────────────

LANG_SEGMENT_PATTERNS = {
    "fr": ["/fr/", "/fr-", "-fr/", "français", "francais", "/french/"],
    "de": ["/de/", "/german/", "/deutsch/"],
    "es": ["/es/", "/spanish/", "/espanol/"],
    "ar": ["/ar/", "/arabic/"],
    "zh": ["/zh/", "/cn/", "/chinese/"],
    "pt": ["/pt/", "/portuguese/"],
    "it": ["/it/", "/italian/"],
    "nl": ["/nl/", "/dutch/"],
    "ru": ["/ru/", "/russian/"],
    "ja": ["/ja/", "/japanese/"],

    # Indian Languages
    "hi": ["/hi/", "/hindi/"],
    "kn": ["/kn/", "/kannada/"],
    "mr": ["/mr/", "/marathi/"],
    "ta": ["/ta/", "/tamil/"],
    "te": ["/te/", "/telugu/"],
    "bn": ["/bn/", "/bengali/", "/bangla/"],
    "gu": ["/gu/", "/gujarati/"],
    "ml": ["/ml/", "/malayalam/"],
    "pa": ["/pa/", "/punjabi/"],
    "or": ["/or/", "/odia/", "/oriya/"],
    "ur": ["/ur/", "/urdu/"],
    "as": ["/as/", "/assamese/"],
    "ks": ["/ks/", "/kashmiri/"],
    "sa": ["/sa/", "/sanskrit/"],
    "sd": ["/sd/", "/sindhi/"],
    "ne": ["/ne/", "/nepali/"],
    "bho": ["/bho/", "/bhojpuri/"],
    "mai": ["/mai/", "/maithili/"],
    "doi": ["/doi/", "/dogri/"],
    "sat": ["/sat/", "/santali/"],
    "kok": ["/kok/", "/konkani/"],
    "mni": ["/mni/", "/manipuri/"],
}

def detect_language(url, default_lang="en"):
    """
    Auto-detects the language of a URL by checking path segments.
    Returns a 2-letter language code (e.g. 'en', 'fr', 'de').
    """
    url_lower = url.lower()
    parsed = urlparse(url_lower)
    path = parsed.path

    # Check for exact segment like /en/ or /fr/ etc.
    for segment in path.strip("/").split("/"):
        if len(segment) == 2 and segment.isalpha():
            return segment

    # Check for known French-specific path words (backward-compatible with CIM Finance)
    for lang, patterns in LANG_SEGMENT_PATTERNS.items():
        for p in patterns:
            if p in url_lower:
                return lang

    return default_lang


# ──────────────────────────────────────────────────────────────────────────────
# Path Builder
# ──────────────────────────────────────────────────────────────────────────────

def get_site_name(base_url, timeout=15):
    """
    Fetches the homepage and extracts a clean, human-readable website name.
    Priority:
      1. og:site_name meta tag       (most accurate, e.g. 'Aadhar Housing Finance')
      2. application-name meta tag   (common on PWA / modern sites)
      3. LAST part of <title> tag    (brand name is usually at end: 'Page Title | Brand Name')
      4. Domain name without TLD     (fallback)
    """
    try:
        response = requests.get(base_url, headers=HEADERS, timeout=timeout, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")

        # 1. Try og:site_name
        og_site = soup.find("meta", property="og:site_name")
        if og_site and og_site.get("content"):
            name = og_site["content"].strip()
            if name:
                return re.sub(r'[<>:"/\\|?*]', '', name).strip()

        # 2. Try application-name meta tag
        app_name = soup.find("meta", attrs={"name": "application-name"})
        if app_name and app_name.get("content"):
            name = app_name["content"].strip()
            if name:
                return re.sub(r'[<>:"/\\|?*]', '', name).strip()

        # 3. Try page title — take the LAST part after | or - (brand is usually at end)
        if soup.title:
            raw_title = soup.title.get_text(strip=True)
            for sep in [" | ", " - ", " :: ", " — "]:
                if sep in raw_title:
                    name = raw_title.split(sep)[-1].strip()
                    if name and len(name) > 2:
                        return re.sub(r'[<>:"/\\|?*]', '', name).strip()

    except Exception:
        pass

    # 4. Fallback: use domain without TLD, title-cased
    netloc = urlparse(base_url).netloc.lower()
    domain = re.sub(r'^www\.', '', netloc)
    name = domain.split(".")[0].replace("-", " ").replace("_", " ").title()
    return name


def get_target_path(url, output_dir="pages", default_lang="en", site_name=None):
    """
    Converts a URL into a structured folder path under output_dir.

    Rules:
      - A website-name folder is created first (base domain without www).
      - Language is detected from the URL (e.g. /en/, /fr/).
      - Standard subdomains (www, blog, about, home, shop) get named sections.
      - Unknown subdomains go into OTHERS/<subdomain>.
      - Query string parameters are included in the folder name to avoid collisions.

    Example:
      https://example.com/en/products/shoes  -> pages/example.com/en/products/shoes/
      https://blog.example.com/en/post-1     -> pages/example.com/en/BLOG/blog.example.com/post-1/
      https://example.com/fr/a-propos        -> pages/example.com/fr/a-propos/
    """
    parsed = urlparse(url)
    lang = detect_language(url, default_lang)

    path = parsed.path.strip("/")

    # Strip leading language segment from path (e.g. /en/products -> products)
    lang_prefixes = [f"{lang}/", f"{lang}-"]
    for prefix in lang_prefixes:
        if path.lower().startswith(prefix):
            path = path[len(prefix):]
            break
    if path.lower() == lang:
        path = ""

    # Encode query string into folder name to avoid collisions
    query = parsed.query
    if query:
        query_safe = re.sub(r'[^a-zA-Z0-9_\-]', '_', query)
        path = f"{path}_{query_safe}" if path else query_safe

    # Determine the base domain (strip www.)
    netloc = parsed.netloc.lower()
    base_domain = re.sub(r'^www\.', '', netloc)

    # Extract subdomain
    # e.g. blog.example.com -> subdomain = blog
    domain_parts = base_domain.split(".")
    if len(domain_parts) > 2:
        subdomain = domain_parts[0]
    else:
        subdomain = None

    # Map known subdomains to named sections
    SUBDOMAIN_SECTIONS = {
        "about": "ABOUT",
        "home": "HOME",
        "blog": "BLOG",
        "shop": "SHOP",
        "store": "SHOP",
        "support": "SUPPORT",
        "help": "SUPPORT",
        "docs": "DOCS",
        "developer": "DOCS",
        "api": "DOCS",
        "news": "NEWS",
        "media": "NEWS",
        "members": "MEMBERS",
        "portal": "PORTAL",
        "app": "APP",
        "simulator": "TOOLS",
        "tools": "TOOLS",
        "careers": "CAREERS",
        "jobs": "CAREERS",
    }

    # Use site_name as the root folder. Fall back to base_domain if not provided.
    root_name = site_name if site_name else base_domain

    if subdomain and subdomain in SUBDOMAIN_SECTIONS:
        section = SUBDOMAIN_SECTIONS[subdomain]
        parts = [root_name, output_dir, lang, section, netloc]
    elif subdomain:
        parts = [root_name, output_dir, lang, "OTHERS", netloc]
    else:
        parts = [root_name, output_dir, lang]

    if path:
        parts.append(path.replace("/", os.sep))
    else:
        # Homepage — place content in HOME folder instead of language root
        parts.append("HOME")

    return os.path.join(*parts)


# ──────────────────────────────────────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────────────────────────────────────

def is_valid_url(url):
    """Filters out non-page URLs such as tel:, mailto:, WhatsApp links, anchors."""
    skip_prefixes = ("tel:", "mailto:", "javascript:", "whatsapp:", "sms:", "#")
    return url.startswith("http") and not any(url.startswith(p) for p in skip_prefixes)


def fetch_with_retry(context, url, retries=2, timeout=20):
    """Fetches a URL using a shared Playwright context with retry logic, auto-waiting, and auto-clicking."""
    last_error = None
    for attempt in range(retries + 1):
        page = None
        try:
            page = context.new_page()
            
            # Navigate and wait for the page to load (networkidle causes 20-second hangs on most sites due to analytics)
            page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)
            
            # Wait a brief moment for JS frameworks to render
            page.wait_for_timeout(1000)
            
            # Scroll down to trigger lazy loading
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1000)
            
            # Try to click "Show More" or similar buttons using fast browser-side locators
            try:
                # The 'i' modifier makes it case-insensitive
                selectors = [
                    'button:has-text("show more" i)',
                    'button:has-text("load more" i)',
                    'button:has-text("read more" i)',
                    'button:has-text("view more" i)',
                    'a:has-text("show more" i)',
                    'a:has-text("load more" i)',
                    'a:has-text("read more" i)',
                    'a:has-text("view more" i)',
                ]
                more_button = page.locator(", ".join(selectors)).first
                if more_button.is_visible(timeout=500):
                    more_button.click(timeout=1000)
                    page.wait_for_timeout(1000)
            except Exception:
                pass
            
            html_content = page.content()
            page.close()
            return html_content
        except Exception as e:
            last_error = e
            if page:
                try:
                    page.close()
                except Exception:
                    pass
            if attempt < retries:
                wait = 2 ** attempt
                time.sleep(wait)
    raise last_error or RuntimeError(f"Failed to fetch {url} after {retries} retries")


# ──────────────────────────────────────────────────────────────────────────────
# Content Extraction
# ──────────────────────────────────────────────────────────────────────────────

def process_element(element, content_lines, page_url, depth=0):
    """
    Recursively walks the HTML DOM and extracts content as structured Markdown.
    Handles headings, paragraphs, lists, links, images, and SVGs.
    """
    if not hasattr(element, "name") or not element.name:
        if hasattr(element, "string") and element.string:
            text = element.string.strip()
            if text and len(text) > 1 and "{" not in text and "}" not in text:
                content_lines.append(text)
        return

    tag = element.name

    if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
        level = int(tag[1])
        text = element.get_text(separator=" ", strip=True)
        if text:
            content_lines.append(f"\n{'#' * level} {text}\n")

    elif tag == "p":
        text = element.get_text(separator=" ", strip=True)
        if text:
            content_lines.append(f"{text}\n")

    elif tag == "li":
        text = element.get_text(separator=" ", strip=True)
        if text:
            content_lines.append(f"- {text}")

    elif tag == "a":
        text = element.get_text(separator=" ", strip=True)
        href = element.get("href", "")
        if text and len(text) > 2:
            content_lines.append(f"[{text}]({href})")
        # Also process any nested images inside the link
        for child in element.children:
            if getattr(child, "name", None) == "img":
                process_element(child, content_lines, page_url, depth + 1)

    elif tag == "img":
        src = (element.get("src") or element.get("data-src") or
               element.get("data-lazy-src") or element.get("data-original"))
        if src and not src.startswith("data:"):
            img_url = urljoin(page_url, src)
            alt = element.get("alt", "").strip() or "(Image)"
            filename = os.path.basename(urlparse(img_url).path)
            if not filename or "." not in filename:
                filename = f"image_{int(time.time() * 1000)}.jpg"
            content_lines.append(f"![{alt}](images/{filename})")

    elif tag == "svg":
        content_lines.append("[Inline SVG Icon]")

    elif tag == "table":
        # Basic table extraction
        rows = element.find_all("tr")
        for row in rows:
            cells = row.find_all(["th", "td"])
            row_text = " | ".join(c.get_text(separator=" ", strip=True) for c in cells)
            if row_text:
                content_lines.append(f"| {row_text} |")

    else:
        for child in element.children:
            process_element(child, content_lines, page_url, depth + 1)


def extract_structured_data(soup, page_url):
    """
    Extracts the page into a clean, structured JSON format grouped by headings.
    Uses a recursive DOM walker to ensure 100% parity with the Markdown output.
    """
    data = {
        "page_meta": {},
        "sections": []
    }
    
    data["page_meta"]["title"] = soup.title.get_text(strip=True) if soup.title else ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    data["page_meta"]["description"] = meta_desc["content"].strip() if meta_desc and meta_desc.get("content") else ""
    
    current_section = {"heading": "Header / Intro", "level": 1, "content": []}
    
    def walk_dom(element):
        nonlocal current_section
        
        if not hasattr(element, "name") or not element.name:
            if hasattr(element, "string") and element.string:
                text = element.string.strip()
                if text and len(text) > 1 and "{" not in text and "}" not in text:
                    current_section["content"].append({"type": "text", "tag": "text", "value": text})
            return

        tag = element.name

        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            text = element.get_text(separator=" ", strip=True)
            if text:
                if current_section["content"] or current_section["heading"] != "Header / Intro":
                    data["sections"].append(current_section)
                current_section = {"heading": text, "level": int(tag[1]), "content": []}
                
        elif tag == "p":
            text = element.get_text(separator=" ", strip=True)
            if text:
                current_section["content"].append({"type": "text", "tag": "p", "value": text})
                
        elif tag == "li":
            text = element.get_text(separator=" ", strip=True)
            if text:
                current_section["content"].append({"type": "text", "tag": "li", "value": text})
                
        elif tag == "a":
            text = element.get_text(separator=" ", strip=True)
            href = element.get("href", "")
            if text and len(text) > 2:
                current_section["content"].append({"type": "link", "text": text, "url": href})
            # Process images inside links
            for child in element.children:
                if getattr(child, "name", None) == "img":
                    walk_dom(child)
                    
        elif tag == "img":
            src = element.get("src") or element.get("data-src") or element.get("data-lazy-src") or element.get("data-original")
            if src and not src.startswith("data:"):
                img_url = urljoin(page_url, src)
                alt = element.get("alt", "").strip() or "(Image)"
                filename = os.path.basename(urlparse(img_url).path)
                if not filename or "." not in filename:
                    filename = f"image_{int(time.time() * 1000)}.jpg"
                current_section["content"].append({"type": "image", "src": f"images/{filename}", "alt": alt})
                
        elif tag == "table":
            rows = element.find_all("tr")
            for row in rows:
                cells = row.find_all(["th", "td"])
                row_text = " | ".join(c.get_text(separator=" ", strip=True) for c in cells)
                if row_text:
                    current_section["content"].append({"type": "text", "tag": "table_row", "value": row_text})

        else:
            for child in element.children:
                walk_dom(child)

    # Use the body to iterate through the logical flow of the page
    main_content = soup.body if soup.body else soup
    walk_dom(main_content)

    if current_section["content"] or current_section["heading"] != "Header / Intro":
        data["sections"].append(current_section)
        
    return data


def is_homepage(url):
    """
    Returns True if the URL is the homepage or a language root page.
    e.g. https://example.com/, https://example.com/en/, https://example.com/en
    """
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    # Remove 2-letter language prefix if present
    parts = path.split("/")
    if len(parts) == 1 and (parts[0] == "" or len(parts[0]) == 2):
        return True
    if len(parts) == 0:
        return True
    return False


def get_main_content(soup, url):
    """
    Removes only navigation menus from all pages to eliminate
    repeated navbar links. Header, footer and all other content
    is kept intact.
    """
    # Remove only navigation menus — these repeat on every page
    for tag in soup.find_all("nav"):
        tag.decompose()

    # Remove elements with navigation ARIA role
    for tag in soup.find_all(attrs={"role": "navigation"}):
        tag.decompose()

    # Return full body with everything else intact
    return soup.body if soup.body else soup


import concurrent.futures

def download_images(soup, page_url, images_folder):
    """Downloads all images found on the page in parallel. Returns count of images saved."""
    image_urls = set()
    for img in soup.find_all("img"):
        src = (img.get("src") or img.get("data-src") or
               img.get("data-lazy-src") or img.get("data-original"))
        if src and not src.startswith("data:"):
            image_urls.add(urljoin(page_url, src))

    def fetch_image(img_url):
        try:
            filename = os.path.basename(urlparse(img_url).path)
            if not filename or "." not in filename:
                filename = f"image_{int(time.time() * 1000)}.jpg"
            img_path = os.path.join(images_folder, filename)
            if not os.path.exists(img_path):
                resp = requests.get(img_url, headers=HEADERS, timeout=10, verify=False)
                with open(img_path, "wb") as f:
                    f.write(resp.content)
            return True
        except Exception:
            return False

    count = 0
    if image_urls:
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = executor.map(fetch_image, image_urls)
            count = sum(1 for r in results if r)
            
    return count


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Universal Website Scraper — scrapes any website from a URL list.",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("urls_file", help="Path to the text file containing URLs (one per line)")
    parser.add_argument("--out", default="pages", help="Output root directory (default: pages)")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between requests in seconds (default: 0.5)")
    parser.add_argument("--retries", type=int, default=2, help="Retries on request failure (default: 2)")
    parser.add_argument("--timeout", type=int, default=20, help="Request timeout in seconds (default: 20)")
    parser.add_argument("--default-lang", default="en", help="Default language code when none detected (default: en)")
    parser.add_argument("--name", help="Custom website name to use as root folder (overrides auto-detection)")
    return parser.parse_args()


def main():
    args = parse_args()

    # Suppress InsecureRequestWarning for sites with self-signed certs
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    # Read URLs
    with open(args.urls_file, "r", encoding="utf-8") as f:
        raw_urls = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]

    valid_urls = [u for u in raw_urls if is_valid_url(u)]
    skipped = len(raw_urls) - len(valid_urls)
    print(f"\nLoaded {len(raw_urls)} URLs. Valid: {len(valid_urls)}, Skipped (invalid): {skipped}")
    print(f"Output directory : {os.path.abspath(args.out)}")
    print(f"Delay            : {args.delay}s | Retries: {args.retries} | Timeout: {args.timeout}s\n")
    print("=" * 60)

    failed_urls = []
    site_index = []

    # Detect or use provided site name
    if args.name:
        site_name = args.name.strip()
        print(f"Using provided Website Name: '{site_name}'")
    else:
        first_url = valid_urls[0] if valid_urls else ""
        parsed_first = urlparse(first_url)
        base_url_for_name = f"{parsed_first.scheme}://{parsed_first.netloc}/"
        site_name = get_site_name(base_url_for_name, timeout=args.timeout)
        print(f"Website name detected: '{site_name}'")

    # Sanitize for use as folder name
    site_name = re.sub(r'[<>:"/\\|?*]', '', site_name).strip() or "website"
    print("=" * 60)

    # Launch a single Playwright browser for the entire session
    with sync_playwright() as p:
        print("Launching Chromium browser for scraping...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=HEADERS["User-Agent"])

        for i, url in enumerate(valid_urls, 1):
            print(f"[{i}/{len(valid_urls)}] {url}")
    
            base_folder = get_target_path(url, args.out, args.default_lang, site_name)
            images_folder = os.path.join(base_folder, "images")
            os.makedirs(images_folder, exist_ok=True)
    
            html_file = os.path.join(base_folder, "content.html")
            html_content = ""
    
            # Skip fetch if HTML already saved
            if os.path.exists(html_file):
                print("  -> Already scraped, loading from disk.")
                with open(html_file, "r", encoding="utf-8", errors="replace") as f:
                    html_content = f.read()
            else:
                try:
                    html_content = fetch_with_retry(context, url, retries=args.retries, timeout=args.timeout)
                    with open(html_file, "w", encoding="utf-8") as f:
                        f.write(html_content)
                except Exception as e:
                    print(f"  [FAILED] {e}\n")
                    failed_urls.append(url)
                    continue
    
            # Parse HTML
            soup = BeautifulSoup(html_content, "html.parser")
            title = soup.title.get_text(strip=True) if soup.title else ""
            meta_desc_tag = soup.find("meta", attrs={"name": "description"})
            meta_desc = meta_desc_tag["content"].strip() if meta_desc_tag and meta_desc_tag.get("content") else ""
            meta_kw_tag = soup.find("meta", attrs={"name": "keywords"})
            meta_keywords = meta_kw_tag["content"].strip() if meta_kw_tag and meta_kw_tag.get("content") else ""
    
            # Remove clutter
            for tag in soup.find_all(["script", "style", "noscript"]):
                tag.decompose()
    
            # Download images
            num_images = download_images(soup, url, images_folder)
    
            # Build Markdown content
            content_lines = []
            content_lines.append(f"# URL: {url}")
            content_lines.append(f"# Title: {title}")
            content_lines.append(f"# Meta Description: {meta_desc}")
            if meta_keywords:
                content_lines.append(f"# Keywords: {meta_keywords}")
            content_lines.append("")
    
            main_content = get_main_content(soup, url)
            process_element(main_content, content_lines, url)
    
            # Save content.md
            with open(os.path.join(base_folder, "content.md"), "w", encoding="utf-8") as f:
                f.write("\n".join(content_lines))
    
            # Save structure.json
            structured_data = extract_structured_data(soup, url)
            with open(os.path.join(base_folder, "structure.json"), "w", encoding="utf-8") as f:
                json.dump(structured_data, f, indent=2, ensure_ascii=False)
    
            site_index.append({
                "url": url,
                "title": title,
                "meta_description": meta_desc,
                "folder": base_folder,
                "num_images": num_images
            })
    
            print(f"  Saved -> {base_folder}  (images: {num_images})\n")
            time.sleep(args.delay)
            
        browser.close()

    # Save site index inside the website's root folder
    index_dir = os.path.join(site_name, args.out)
    os.makedirs(index_dir, exist_ok=True)
    index_path = os.path.join(index_dir, "site_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(site_index, f, indent=2, ensure_ascii=False)

    # Save failed URLs
    if failed_urls:
        failed_path = "failed_urls.txt"
        with open(failed_path, "w", encoding="utf-8") as f:
            f.write("\n".join(failed_urls))
        print(f"\n[WARNING] {len(failed_urls)} URLs failed. Saved to '{failed_path}' for retry.")
    else:
        print("\nAll URLs scraped successfully! No failures.")

    print(f"\nDone! {len(site_index)} pages saved")
    print(f"Site index saved: {index_path}")


if __name__ == "__main__":
    main()
