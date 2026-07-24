#!/usr/bin/env python3
"""
url_finder.py — Universal Website URL Crawler
==============================================
Starting from a base URL (homepage), this tool crawls the entire website
by following all internal links. It discovers and saves every unique page URL.
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse
from collections import deque
import time
import argparse
import sys
import re
from playwright.sync_api import sync_playwright

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

SKIP_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".rar", ".tar", ".gz", ".7z",
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico", ".bmp",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv",
    ".css", ".js", ".json", ".xml", ".txt", ".csv",
    ".exe", ".msi", ".apk", ".dmg", ".iso"
}

SKIP_PREFIXES = ["mailto:", "tel:", "javascript:", "#"]
SKIP_DOMAINS = ["facebook.com", "twitter.com", "instagram.com", "linkedin.com", "youtube.com", "pinterest.com", "tiktok.com"]

def get_base_domain(url):
    netloc = urlparse(url).netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    parts = netloc.split('.')
    if len(parts) > 2:
        # Check for co.uk or similar (basic heuristic)
        if parts[-2] in ["co", "com", "org", "net", "edu", "gov", "ac"] and len(parts[-1]) == 2:
            return ".".join(parts[-3:])
        return ".".join(parts[-2:])
    return netloc

def normalize_url(url):
    parsed = urlparse(url)
    normalized = urlunparse((
        "https",
        parsed.netloc.lower(),
        parsed.path.rstrip("/") or "/",
        parsed.params,
        parsed.query,
        ""  # Remove fragment
    ))
    return normalized

def is_valid_url(url, base_domain, same_domain_only=True, include_words=None, exclude_words=None):
    if not url or not url.startswith("http"):
        return False
    if any(url.startswith(p) for p in SKIP_PREFIXES):
        return False
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    path = parsed.path.lower()
    for skip in SKIP_DOMAINS:
        if skip in netloc:
            return False
    if same_domain_only:
        url_base_domain = get_base_domain(url)
        if url_base_domain != base_domain:
            return False
    ext = ""
    path_only = parsed.path
    if "." in path_only.split("/")[-1]:
        ext = "." + path_only.split(".")[-1].lower()
    if ext in SKIP_EXTENSIONS:
        return False
    url_lower = url.lower()
    if include_words:
        if not any(w.lower() in url_lower for w in include_words):
            return False
    if exclude_words:
        if any(w.lower() in url_lower for w in exclude_words):
            return False
    return True

def extract_links(html, page_url):
    soup = BeautifulSoup(html, "html.parser")
    seen = set()
    links = []
    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        if not href or href.startswith(tuple(SKIP_PREFIXES)):
            continue
        full_url = urljoin(page_url, href).split("#")[0]
        if full_url and full_url not in seen:
            seen.add(full_url)
            links.append(full_url)
    return links

def extract_nav_links_ordered(html, page_url):
    soup = BeautifulSoup(html, "html.parser")
    nav_tags = soup.find_all("nav")
    seen = set()
    ordered_links = []
    if nav_tags:
        for nav in nav_tags:
            for tag in nav.find_all("a", href=True):
                href = tag["href"].strip()
                if not href or href.startswith(tuple(SKIP_PREFIXES)):
                    continue
                full_url = urljoin(page_url, href).split("#")[0]
                if full_url and full_url not in seen:
                    seen.add(full_url)
                    ordered_links.append(full_url)
        if ordered_links:
            # We found nav links, but we shouldn't throw away the rest of the page links!
            # Especially for JS-rendered links (like language switchers) that might not be inside a <nav> tag.
            all_links = extract_links(html, page_url)
            for link in all_links:
                if link not in seen:
                    seen.add(link)
                    ordered_links.append(link)
            return ordered_links, True
    return extract_links(html, page_url), False

def fetch_page(url, timeout=15, page=None):
    if page:
        try:
            response = page.goto(url, wait_until="networkidle", timeout=timeout*1000)
            page.wait_for_timeout(2000)
            return page.content(), response.status if response else 200
        except Exception as e:
            return None, str(e)
    else:
        try:
            response = requests.get(url, headers=HEADERS, timeout=timeout, verify=False)
            if "text/html" not in response.headers.get("Content-Type", ""):
                return None, "Not an HTML page"
            return response.text, response.status_code
        except Exception as e:
            return None, str(e)

def is_soft_404(html):
    if not html: return False
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.lower() if soup.title and soup.title.string else ""
    if "404" in title or "not found" in title or "page not found" in title:
        return True
    h1 = soup.find("h1")
    if h1 and h1.string:
        h1_text = h1.string.lower()
        if "404" in h1_text or "page not found" in h1_text:
            return True
    return False

def crawl(start_url, out_file, max_pages=None, delay=0.5, timeout=15,
          max_depth=None, include_words=None, exclude_words=None,
          same_domain_only=True):
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    base_domain = get_base_domain(start_url)
    print(f"\\nStarting crawl from : {start_url}")
    print(f"Base domain         : {base_domain}")
    print(f"Output file         : {out_file}")
    if max_pages: print(f"Max pages           : {max_pages}")
    if max_depth: print(f"Max depth           : {max_depth}")
    if include_words: print(f"Include filter      : {include_words}")
    if exclude_words: print(f"Exclude filter      : {exclude_words}")
    print("=" * 60)

    queue = deque()
    norm_start = normalize_url(start_url)
    queue.append((norm_start, 0))
    visited = set()
    discovered_urls = []
    failed = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True, user_agent=HEADERS["User-Agent"])
        page = context.new_page()

        print(f"Fetching homepage to extract navigation order...")
        home_html, home_status = fetch_page(start_url, timeout=timeout, page=page)
        if home_html:
            nav_links, nav_found = extract_nav_links_ordered(home_html, start_url)
            if nav_found:
                print(f"  Navigation found in HTML — seeding {len(nav_links)} nav links in order.")
            else:
                print(f"  No <nav> tag found — using all homepage links as seed (JS-rendered navbar?).")

            nav_queue = deque()
            for link in nav_links:
                norm = normalize_url(link)
                if is_valid_url(link, base_domain=base_domain,
                                same_domain_only=same_domain_only,
                                include_words=include_words,
                                exclude_words=exclude_words):
                    if norm not in visited:
                        nav_queue.append((norm, 1))

            queue = nav_queue + queue
        else:
            print(f"  Could not fetch homepage for nav extraction. Falling back to normal BFS.")

        print("=" * 60)

        while queue:
            url, depth = queue.popleft()
            if url in visited: continue
            if max_pages and len(discovered_urls) >= max_pages:
                print(f"\\nReached max pages limit ({max_pages}). Stopping.")
                break
            if max_depth is not None and depth > max_depth: continue

            visited.add(url)
            print(f"[{len(discovered_urls)+1}] (depth={depth}) {url}")

            html, status = fetch_page(url, timeout=timeout, page=None)
            
            # Fast fail for 500 errors
            if isinstance(status, int) and status >= 500:
                print(f"  [SKIP] HTTP {status}")
                failed.append((url, f"HTTP {status}"))
                time.sleep(delay)
                continue
                
            # Smart fail for 404s (Genuine 404 pages)
            if is_soft_404(html) or (isinstance(status, int) and status == 404 and "404" in (html or "").lower()):
                print(f"  [SKIP] 404 Not Found Detected")
                failed.append((url, "404 Not Found"))
                time.sleep(delay)
                continue

            raw_links = extract_links(html, url) if html else []
            
            if not html or len(raw_links) < 5:
                # Fast HTTP failed or hit a JS-rendered skeleton page
                html, p_status = fetch_page(url, timeout=timeout, page=page)
                
                if isinstance(p_status, int) and p_status >= 500:
                    print(f"  [SKIP] Playwright HTTP {p_status}")
                    failed.append((url, f"HTTP {p_status}"))
                    time.sleep(delay)
                    continue
                    
                if is_soft_404(html) or (isinstance(p_status, int) and p_status == 404 and "404" in (html or "").lower()):
                    print(f"  [SKIP] Playwright 404 Detected")
                    failed.append((url, "404 Not Found"))
                    time.sleep(delay)
                    continue

                if html:
                    raw_links = extract_links(html, url)
            
            if html is None:
                print(f"  [SKIP] Fetch Failed ({status})")
                failed.append((url, f"Failed ({status})"))
                time.sleep(delay)
                continue

            discovered_urls.append(url)
            print(f"  Found -> {url}  (total: {len(discovered_urls)})")
            new_links_added = 0
            for link in raw_links:
                norm = normalize_url(link)
                if norm not in visited:
                    if is_valid_url(link, base_domain=base_domain, same_domain_only=same_domain_only,
                                    include_words=include_words, exclude_words=exclude_words):
                        queue.append((norm, depth + 1))
                        new_links_added += 1

            if new_links_added:
                print(f"  Queued {new_links_added} new links from this page.")
            
            time.sleep(delay)

        browser.close()

    with open(out_file, "w", encoding="utf-8") as f:
        for u in discovered_urls:
            f.write(u + "\n")
            
    # Write failed URLs to failed_urls.txt in the same directory
    import os
    failed_file = os.path.join(os.path.dirname(out_file), "failed_urls.txt")
    with open(failed_file, "w", encoding="utf-8") as f:
        for u, r in failed:
            f.write(f"{u}\t{r}\n")
    
    print("=" * 60)
    print("Crawl complete!")
    print(f"Total pages found   : {len(discovered_urls)}")
    print(f"Total pages skipped : {len(failed)}")
    print(f"URLs saved to       : {out_file}")
    print("=" * 60)
    print("Next step — scrape all discovered pages:")
    print(f"python script/web_scraper.py {out_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Universal Website URL Crawler")
    parser.add_argument("start_url", help="The homepage or starting URL")
    parser.add_argument("--out", default="urls.txt", help="Output file to save discovered URLs")
    parser.add_argument("--max", type=int, help="Maximum number of pages to crawl")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between requests (seconds)")
    parser.add_argument("--timeout", type=int, default=15, help="Request timeout (seconds)")
    parser.add_argument("--depth", type=int, default=2 ,help="Maximum crawl depth")
    parser.add_argument("--include", action="append", help="Only include URLs containing this word")
    parser.add_argument("--exclude", action="append", help="Skip URLs containing this word")
    parser.add_argument("--no-strict-domain", dest="same_domain", action="store_false", help="Allow crawling external domains")
    args = parser.parse_args()

    crawl(
        start_url=args.start_url,
        out_file=args.out,
        max_pages=args.max,
        delay=args.delay,
        timeout=args.timeout,
        max_depth=args.depth,
        include_words=args.include,
        exclude_words=args.exclude,
        same_domain_only=args.same_domain
    )
