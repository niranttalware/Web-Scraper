"""
download_routes.py — Routes for downloading ZIP and Excel URL reports.
"""

import os
import time
import threading
from flask import Blueprint, jsonify, send_file
from services.job_manager import jobs
from services.excel_generator import generate_url_report_xlsx
from db.history_repo import find_by_job_id
from middleware import token_required

download_bp = Blueprint('download', __name__)

def delayed_file_deletion(filepath, delay=30):
    """Deletes a file after a specified delay in seconds (background thread)."""
    def delete_task():
        time.sleep(delay)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"[Cleanup] Automatically deleted file after download: {filepath}")
        except Exception as e:
            print(f"[Cleanup] Failed to delete file {filepath}: {e}")
            
    thread = threading.Thread(target=delete_task)
    thread.daemon = True
    thread.start()


@download_bp.route('/api/download/<job_id>', methods=['GET'])
@token_required
def download(current_user, job_id):
    zip_path = None
    safe_name = 'download'

    if job_id in jobs:
        job = jobs[job_id]
        if job.get('user_id') != current_user['id']:
            return jsonify({'error': 'Job not found'}), 404
        if job['status'] != 'completed':
            return jsonify({'error': 'Job is not completed yet'}), 400
        zip_path = job['zip_path']
        safe_name = job['safe_name']
    else:
        entry = find_by_job_id(job_id, current_user['id'])
        if not entry:
            return jsonify({'error': 'Job not found'}), 404
        zip_path = entry.get('zip_path')
        safe_name = entry.get('safe_name', 'download')

    if not zip_path or not os.path.exists(zip_path):
        return jsonify({'error': 'ZIP file not found. It may have been cleaned up.'}), 404

    # We no longer delete the ZIP after 30 seconds because large downloads
    # will be truncated, causing ZIP corruption. (Cleanup should be handled separately).

    return send_file(zip_path, as_attachment=True, download_name=f'{safe_name}.zip')


@download_bp.route('/api/download_urls/<job_id>', methods=['GET'])
@token_required
def download_urls(current_user, job_id):
    preview_data = {}
    safe_name = 'report'

    if job_id in jobs:
        job = jobs[job_id]
        if job.get('user_id') != current_user['id']:
            return jsonify({'error': 'Job not found'}), 404
        preview_data = job.get('preview_data', {})
        safe_name = job.get('safe_name', 'report')
    else:
        entry = find_by_job_id(job_id, current_user['id'])
        if not entry:
            return jsonify({'error': 'Job not found'}), 404
        preview_data = entry.get('preview_data', {})
        safe_name = entry.get('safe_name', 'report')

    out = generate_url_report_xlsx(preview_data, safe_name)

    return send_file(
        out,
        as_attachment=True,
        download_name=f'URL_Report_{safe_name}.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
