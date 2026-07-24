"""
job_manager.py — In-memory job store and all background thread logic.

Extracted from app.py to keep route files clean.
"""

import os
import re
import uuid
import shutil
import subprocess
import threading
import zipfile
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

URL_FINDER_SCRIPT = os.path.join(BASE_DIR, 'script', 'url_finder.py')
WEB_SCRAPER_SCRIPT = os.path.join(BASE_DIR, 'script', 'web_scraper.py')

# In-memory store for active scraping jobs (keyed by job_id)
jobs = {}


def cleanup_job_dir(job_dir):
    if os.path.exists(job_dir):
        try:
            shutil.rmtree(job_dir)
        except Exception:
            pass


def run_process_and_log(cmd, job_id, phase_name, cwd=None):
    """Run a subprocess and stream its stdout into the job's log list."""
    jobs[job_id]['phase'] = phase_name
    jobs[job_id]['logs'].append(f'--- Starting: {phase_name} ---')

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True,
        cwd=cwd,
    )
    jobs[job_id]['process'] = process

    for line in iter(process.stdout.readline, ''):
        if jobs[job_id]['status'] == 'stopped':
            break

        if line:
            clean_line = line.strip()
            if clean_line:
                jobs[job_id]['logs'].append(clean_line)

                match = re.search(r'\[(\d+)/(\d+)\]', clean_line)
                if match:
                    jobs[job_id]['stats']['scraped'] = int(match.group(1))
                    jobs[job_id]['stats']['total'] = int(match.group(2))

                img_match = re.search(r'\(images:\s*(\d+)\)', clean_line)
                if img_match:
                    jobs[job_id]['stats']['images'] += int(img_match.group(1))

                if len(jobs[job_id]['logs']) > 200:
                    jobs[job_id]['logs'].pop(0)

    process.stdout.close()

    if jobs[job_id]['status'] == 'stopped':
        return False

    return_code = process.wait()
    if return_code != 0:
        raise subprocess.CalledProcessError(return_code, cmd)
    return True


def background_scrape_data(job_id, mode, input_urls, name, safe_name, job_dir, zip_path):
    """Phase 2: Run the web scraper then zip the results and save to history."""
    # Import here to avoid circular imports
    from db.history_repo import save_history_entry

    try:
        jobs[job_id]['status'] = 'running'
        urls_file = os.path.join(job_dir, 'urls.txt')

        scraper_cmd = [
            'python', '-u', WEB_SCRAPER_SCRIPT,
            urls_file,
            '--name', safe_name,
        ]
        success = run_process_and_log(scraper_cmd, job_id, 'Scraping Pages', cwd=job_dir)
        if not success:
            return

        target_folder = os.path.join(job_dir, safe_name)
        if not os.path.exists(target_folder):
            raise Exception('Scraping failed to produce the expected folder.')

        jobs[job_id]['phase'] = 'Zipping Files'
        jobs[job_id]['logs'].append(f'Compressing {safe_name} into ZIP...')

        preview_data = {}

        if os.path.exists(urls_file):
            try:
                with open(urls_file, 'r', encoding='utf-8') as f:
                    urls_content = f.read()
                    preview_data['urls.txt'] = {
                        'json': urls_content,
                        'md': urls_content,
                        'html': urls_content,
                    }
            except Exception:
                pass

        pages_dir = os.path.join(target_folder, 'pages')
        if os.path.exists(pages_dir):
            for root, dirs, files in os.walk(pages_dir):
                if 'structure.json' in files:
                    rel_path = os.path.relpath(root, pages_dir).replace('\\', '/')
                    page_data = {}

                    try:
                        with open(os.path.join(root, 'structure.json'), 'r', encoding='utf-8') as f:
                            jdata = json.load(f)
                            if 'sections' in jdata:
                                jdata['sections'] = jdata['sections'][:2]
                            page_data['json'] = json.dumps(jdata, indent=2)
                    except Exception:
                        pass

                    if 'content.md' in files:
                        try:
                            with open(os.path.join(root, 'content.md'), 'r', encoding='utf-8') as f:
                                page_data['md'] = ''.join(f.readlines()[:40]) + '\n\n... (truncated for preview)'
                        except Exception:
                            pass

                    if 'content.html' in files:
                        try:
                            with open(os.path.join(root, 'content.html'), 'r', encoding='utf-8') as f:
                                page_data['html'] = ''.join(f.readlines()[:40]) + '\n\n... (truncated for preview)'
                        except Exception:
                            pass

                    if page_data:
                        preview_data[rel_path] = page_data

        # Recalculate working and failed URLs from Phase 2 results
        failed_urls_list = []
        failed_file = os.path.join(job_dir, 'failed_urls.txt')
        if os.path.exists(failed_file):
            with open(failed_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        parts = line.strip().split('\t', 1)
                        if len(parts) == 2:
                            failed_urls_list.append({'url': parts[0], 'reason': parts[1]})
                        else:
                            failed_urls_list.append({'url': parts[0], 'reason': 'Unknown'})

        all_urls = []
        if os.path.exists(urls_file):
            with open(urls_file, 'r', encoding='utf-8') as f:
                all_urls = [line.strip() for line in f if line.strip()]

        failed_url_strings = {f['url'] for f in failed_urls_list}
        working_urls_list = [u for u in all_urls if u not in failed_url_strings]

        preview_data['working_urls'] = working_urls_list
        preview_data['failed_urls'] = failed_urls_list

        if 'stats' not in jobs[job_id]:
            jobs[job_id]['stats'] = {'scraped': 0, 'total': 0, 'images': 0}
        jobs[job_id]['stats']['working_count'] = len(working_urls_list)
        jobs[job_id]['stats']['failed_count'] = len(failed_urls_list)
        jobs[job_id]['stats']['total_discovered'] = len(working_urls_list) + len(failed_urls_list)

        # Merge with existing preview_data (which contains working_urls and failed_urls from Phase 1)
        existing_preview = jobs[job_id].get('preview_data') or {}
        existing_preview.update(preview_data)
        jobs[job_id]['preview_data'] = existing_preview

        # Create ZIP
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(target_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Use target_folder as base to avoid redundant top-level folder and reduce path length
                    arcname = os.path.relpath(file_path, target_folder)
                    # Convert backslashes to forward slashes for cross-platform ZIP compatibility
                    arcname = arcname.replace('\\', '/')
                    
                    # Truncate any path segment that is too long (Windows max path protection)
                    parts = arcname.split('/')
                    new_parts = []
                    for p in parts:
                        if len(p) > 80:
                            fname, ext = os.path.splitext(p)
                            p = fname[:80-len(ext)] + ext
                        new_parts.append(p)
                    arcname = '/'.join(new_parts)
                    
                    zipf.write(file_path, arcname)

        jobs[job_id]['logs'].append('ZIP file created successfully.')
        jobs[job_id]['status'] = 'completed'

        final_urls = input_urls if isinstance(input_urls, list) else [input_urls]
        if os.path.exists(urls_file):
            try:
                with open(urls_file, 'r', encoding='utf-8') as f:
                    final_urls = [line.strip() for line in f if line.strip()]
            except Exception:
                pass

        history_entry = {
            'job_id': job_id,
            'user_id': jobs[job_id].get('user_id'),
            'name': name,
            'safe_name': safe_name,
            'job_type': jobs[job_id].get('job_type', 'full_scrape'),
            'mode': mode,
            'urls': final_urls,
            'scraped_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'stats': jobs[job_id].get('stats', {}),
            'zip_path': zip_path,
            'preview_data': jobs[job_id].get('preview_data', {}),
        }
        save_history_entry(history_entry)

    except Exception as e:
        if jobs[job_id]['status'] != 'stopped':
            jobs[job_id]['status'] = 'error'
            jobs[job_id]['error'] = str(e)
            jobs[job_id]['logs'].append(f'ERROR: {str(e)}')
    finally:
        cleanup_job_dir(job_dir)


def background_scrape(job_id, mode, input_urls, name, safe_name, job_dir, zip_path):
    """Phase 1: Find URLs (full mode) or skip straight to scraping (targeted mode)."""
    try:
        jobs[job_id]['status'] = 'running'
        os.makedirs(job_dir, exist_ok=True)

        urls_file = os.path.join(job_dir, 'urls.txt')

        if mode == 'full':
            if isinstance(input_urls, list) and len(input_urls) > 1:
                # Skip discovery if we already received multiple URLs from history
                jobs[job_id]['phase'] = 'Finding URLs'
                jobs[job_id]['logs'].append(f'Received {len(input_urls)} URLs from history, skipping discovery...')
                
                with open(urls_file, 'w', encoding='utf-8') as f:
                    for u in input_urls:
                        if u.strip():
                            f.write(u.strip() + '\n')
                            
                jobs[job_id]['stats'] = jobs[job_id].get('stats', {'scraped': 0, 'total': 0, 'images': 0})
                jobs[job_id]['stats']['total_discovered'] = len(input_urls)
                jobs[job_id]['stats']['working_count'] = len(input_urls)
                jobs[job_id]['stats']['failed_count'] = 0
                
                # Proceed directly to Phase 2
                background_scrape_data(job_id, mode, input_urls, name, safe_name, job_dir, zip_path)
            else:
                # Phase 1: URL Discovery
                finder_cmd = [
                    'python', '-u', URL_FINDER_SCRIPT,
                    input_urls[0] if isinstance(input_urls, list) else input_urls,
                    '--out', urls_file
                ]
                success = run_process_and_log(finder_cmd, job_id, 'Finding URLs', cwd=job_dir)
                if not success:
                    cleanup_job_dir(job_dir)
                    return
    
                if not os.path.exists(urls_file):
                    raise Exception('Failed to extract URLs (File missing).')
    
                jobs[job_id]['status'] = 'urls_discovered'
    
                working_urls = []
                with open(urls_file, 'r', encoding='utf-8') as f:
                    working_urls = [line.strip() for line in f if line.strip()]
    
                failed_urls = []
                failed_file = os.path.join(job_dir, 'failed_urls.txt')
                if os.path.exists(failed_file):
                    with open(failed_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            if line.strip():
                                parts = line.strip().split('\t', 1)
                                if len(parts) == 2:
                                    failed_urls.append({'url': parts[0], 'reason': parts[1]})
                                else:
                                    failed_urls.append({'url': parts[0], 'reason': 'Unknown'})
    
                jobs[job_id]['preview_data'] = {
                    'working_urls': working_urls,
                    'failed_urls': failed_urls,
                }
                if 'stats' not in jobs[job_id]:
                    jobs[job_id]['stats'] = {'scraped': 0, 'total': 0, 'images': 0}
                jobs[job_id]['stats']['total_discovered'] = len(working_urls) + len(failed_urls)
                jobs[job_id]['stats']['working_count'] = len(working_urls)
                jobs[job_id]['stats']['failed_count'] = len(failed_urls)
    
                # --- NEW: Save immediately to history so URLs aren't lost ---
                from db.history_repo import save_history_entry
                history_entry = {
                    'job_id': job_id,
                    'user_id': jobs[job_id].get('user_id'),
                    'name': name,
                    'safe_name': safe_name,
                    'mode': mode,
                    'job_type': 'url_only',
                    'urls': working_urls,
                    'scraped_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'stats': jobs[job_id]['stats'],
                    'zip_path': zip_path,
                    'preview_data': jobs[job_id]['preview_data'],
                }
                save_history_entry(history_entry)
                # -------------------------------------------------------------
    
                return  # Wait for /api/continue_scrape

        else:
            jobs[job_id]['phase'] = 'Preparing URLs'
            jobs[job_id]['logs'].append('--- Starting: Preparing URLs ---')
            jobs[job_id]['logs'].append(f'Writing {len(input_urls)} custom URLs for targeted scraping...')
            with open(urls_file, 'w', encoding='utf-8') as f:
                for u in (input_urls if isinstance(input_urls, list) else [input_urls]):
                    if u.strip():
                        f.write(u.strip() + '\n')

            background_scrape_data(job_id, mode, input_urls, name, safe_name, job_dir, zip_path)

    except Exception as e:
        if jobs[job_id]['status'] != 'stopped':
            jobs[job_id]['status'] = 'error'
            jobs[job_id]['error'] = str(e)
            jobs[job_id]['logs'].append(f'ERROR: {str(e)}')
        cleanup_job_dir(job_dir)


def create_job(name, mode, input_urls, user_id=None, job_type_param=None, job_id=None):
    """Create a new job entry in memory and return the job_id and paths."""
    safe_name = re.sub(r'[<>:"/\\|?*]', '', name).strip() or 'website'
    job_id = job_id or str(uuid.uuid4())
    # Keep the project folder clean by saving workspaces and zips to ~/.webscraper
    app_data_dir = os.path.join(os.path.expanduser('~'), '.webscraper')
    job_dir = os.path.join(app_data_dir, 'workspaces', f'workspace_{job_id}')
    
    downloads_dir = os.path.join(app_data_dir, 'zips')
    os.makedirs(downloads_dir, exist_ok=True)
    zip_path = os.path.join(downloads_dir, f'{safe_name}_{job_id[:4]}.zip')

    jobs[job_id] = {
        'status': 'starting',
        'phase': 'Initializing',
        'logs': [],
        'stats': {'scraped': 0, 'total': 0, 'images': 0},
        'preview_data': None,
        'error': None,
        'zip_path': zip_path,
        'safe_name': safe_name,
        'process': None,
        'mode': mode,
        'input_urls': input_urls,
        'name': name,
        'job_dir': job_dir,
        'user_id': user_id,
        'job_type': job_type_param or ('full_scrape' if mode == 'full' else 'targeted'),
    }
    return job_id, safe_name, job_dir, zip_path
