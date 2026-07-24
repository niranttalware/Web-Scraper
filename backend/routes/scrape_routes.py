"""
scrape_routes.py — Routes for starting, monitoring, stopping, and continuing scrape jobs.
"""

import threading
from flask import Blueprint, request, jsonify
from services.job_manager import jobs, create_job, background_scrape, background_scrape_data
from middleware import token_required

scrape_bp = Blueprint('scrape', __name__)


@scrape_bp.route('/api/scrape', methods=['POST'])
@token_required
def scrape(current_user):
    data = request.json
    mode = data.get('mode', 'full')
    name = data.get('name')
    input_urls = data.get('urls')
    job_type_param = data.get('job_type')
    job_id_param = data.get('job_id')

    if not input_urls or not name:
        return jsonify({'error': 'URLs and Website Name are required'}), 400

    job_id, safe_name, job_dir, zip_path = create_job(name, mode, input_urls, current_user['id'], job_type_param, job_id_param)

    thread = threading.Thread(
        target=background_scrape,
        args=(job_id, mode, input_urls, name, safe_name, job_dir, zip_path),
    )
    thread.daemon = True
    thread.start()

    return jsonify({'job_id': job_id, 'message': 'Scraping started'}), 202


@scrape_bp.route('/api/status/<job_id>', methods=['GET'])
@token_required
def get_status(current_user, job_id):
    if job_id not in jobs or jobs[job_id].get('user_id') != current_user['id']:
        return jsonify({'error': 'Job not found'}), 404

    return jsonify({
        'status': jobs[job_id]['status'],
        'phase': jobs[job_id]['phase'],
        'logs': jobs[job_id]['logs'],
        'stats': jobs[job_id].get('stats', {}),
        'preview_data': jobs[job_id].get('preview_data', None),
        'error': jobs[job_id]['error'],
    })


@scrape_bp.route('/api/stop/<job_id>', methods=['POST'])
@token_required
def stop(current_user, job_id):
    if job_id not in jobs or jobs[job_id].get('user_id') != current_user['id']:
        return jsonify({'error': 'Job not found'}), 404

    job = jobs[job_id]
    if job['status'] in ['running', 'starting', 'urls_discovered']:
        job['status'] = 'stopped'
        job['phase'] = 'Stopped by user'
        job['logs'].append('--- Job was stopped by user ---')

        process = job.get('process')
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except Exception:
                process.kill()

        # Clean up directory after process is stopped
        from services.job_manager import cleanup_job_dir
        if 'job_dir' in job:
            cleanup_job_dir(job['job_dir'])

        return jsonify({'message': 'Job stopped successfully'}), 200

    return jsonify({'message': 'Job is not running'}), 400


@scrape_bp.route('/api/continue_scrape/<job_id>', methods=['POST'])
@token_required
def continue_scrape(current_user, job_id):
    if job_id not in jobs or jobs[job_id].get('user_id') != current_user['id']:
        return jsonify({'error': 'Job not found'}), 404

    job = jobs[job_id]
    if job['status'] != 'urls_discovered':
        return jsonify({'error': 'Job is not in urls_discovered state'}), 400

    # If the user continues scraping data, it transitions from a URL Discovery into a Full Scrape
    if job.get('job_type') == 'url_only':
        job['job_type'] = 'full_scrape'

    thread = threading.Thread(
        target=background_scrape_data,
        args=(job_id, job['mode'], job['input_urls'], job['name'],
              job['safe_name'], job['job_dir'], job['zip_path']),
    )
    thread.daemon = True
    thread.start()

    return jsonify({'message': 'Scraping continued', 'job_id': job_id})
