"""
history_routes.py — Routes for reading, deleting, and previewing scrape history.
Uses history_repo which reads from MongoDB (or falls back to history.json).
"""

import os
import json
import zipfile
from flask import Blueprint, jsonify
from db.history_repo import load_history, find_by_job_id, delete_by_job_id
from middleware import token_required

history_bp = Blueprint('history', __name__)


@history_bp.route('/api/history', methods=['GET'])
@token_required
def get_history(current_user):
    history = load_history(current_user['id'])
    for entry in history:
        entry['zip_available'] = os.path.exists(entry.get('zip_path', ''))
    return jsonify(history)


@history_bp.route('/api/history/<job_id>', methods=['DELETE'])
@token_required
def delete_history_entry(current_user, job_id):
    deleted = delete_by_job_id(job_id, current_user['id'])
    if not deleted:
        return jsonify({'error': 'Entry not found'}), 404
    return jsonify({'message': 'Deleted successfully'}), 200


@history_bp.route('/api/history/<job_id>/preview', methods=['GET'])
@token_required
def get_history_preview(current_user, job_id):
    entry = find_by_job_id(job_id, current_user['id'])
    if not entry:
        return jsonify({'error': 'Job not found'}), 404

    # If the database has preview data, return it directly!
    if 'preview_data' in entry and entry['preview_data']:
        return jsonify(entry['preview_data'])

    zip_path = entry.get('zip_path')
    if not zip_path or not os.path.exists(zip_path):
        return jsonify({'error': 'ZIP file not found.'}), 404

    safe_name = entry.get('safe_name', 'scrape')
    preview_data = {}

    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            urls_path = f'{safe_name}/urls.txt'
            if urls_path in z.namelist():
                content = z.read(urls_path).decode('utf-8')
                preview_data['urls.txt'] = {'json': content, 'md': content, 'html': content}
            else:
                urls = entry.get('urls', [])
                if urls:
                    content = '\n'.join(urls)
                    preview_data['urls.txt'] = {'json': content, 'md': content, 'html': content}

            page_files = [n for n in z.namelist() if n.startswith(f'{safe_name}/pages/')]
            pages = set()
            for p in page_files:
                parts = p.split('/')
                if len(parts) >= 4:
                    rel = '/'.join(parts[2:-1])
                    if rel:
                        pages.add(rel)

            for rel_path in pages:
                page_data = {}
                base_zip_path = f'{safe_name}/pages/{rel_path}'

                if f'{base_zip_path}/structure.json' in page_files:
                    try:
                        content = z.read(f'{base_zip_path}/structure.json').decode('utf-8')
                        jdata = json.loads(content)
                        if 'sections' in jdata:
                            jdata['sections'] = jdata['sections'][:2]
                        page_data['json'] = json.dumps(jdata, indent=2)
                    except Exception:
                        pass

                if f'{base_zip_path}/content.md' in page_files:
                    try:
                        content = z.read(f'{base_zip_path}/content.md').decode('utf-8')
                        page_data['md'] = ''.join(content.splitlines(True)[:40]) + '\n\n... (truncated for preview)'
                    except Exception:
                        pass

                if f'{base_zip_path}/content.html' in page_files:
                    try:
                        content = z.read(f'{base_zip_path}/content.html').decode('utf-8')
                        page_data['html'] = ''.join(content.splitlines(True)[:40]) + '\n\n... (truncated for preview)'
                    except Exception:
                        pass

                if page_data:
                    preview_data[rel_path] = page_data

        return jsonify(preview_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
