/**
 * api/client.js — Central API client for the Web Scraper frontend.
 *
 * All fetch() calls go through here. This makes it easy to:
 *  - Change the base URL in one place (e.g. when deploying to production)
 *  - Add auth headers later (JWT tokens for user login)
 *  - Handle global error behaviour
 */

import { getToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  return res;
}

// ── Scraping ────────────────────────────────────────────────────────────────

export const startScrape = (payload) =>
  request('/api/scrape', { method: 'POST', body: JSON.stringify(payload) });

export const getStatus = (jobId) =>
  request(`/api/status/${jobId}`);

export const stopJob = (jobId) =>
  request(`/api/stop/${jobId}`, { method: 'POST' });

export const continueScrape = (jobId) =>
  request(`/api/continue_scrape/${jobId}`, { method: 'POST' });

// ── Downloads ───────────────────────────────────────────────────────────────

export const getDownloadZipUrl = (jobId) => {
  const token = getToken();
  return `${API_BASE}/api/download/${jobId}?token=${token}`;
};

export const getDownloadUrlsUrl = (jobId) => {
  const token = getToken();
  return `${API_BASE}/api/download_urls/${jobId}?token=${token}`;
};

// ── History ─────────────────────────────────────────────────────────────────

export const getHistory = () =>
  request('/api/history');

export const getHistoryPreview = (jobId) =>
  request(`/api/history/${jobId}/preview`);

export const deleteHistoryEntry = (jobId) =>
  request(`/api/history/${jobId}`, { method: 'DELETE' });
