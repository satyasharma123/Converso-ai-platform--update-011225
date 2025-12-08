import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || process.env.UNIPILE_API_URL;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;

if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY) {
  logger.warn('[Unipile] Missing UNIPILE_BASE_URL or UNIPILE_API_KEY in env. LinkedIn sync will fail.');
}

// Simple rate limiter: max 60 req/min and 300ms gap between calls.
const REQUEST_WINDOW_MS = 60_000;
const REQUEST_LIMIT = 60;
const MIN_GAP_MS = 300;
const requestTimestamps: number[] = [];
let lastRequestAt = 0;

const api: AxiosInstance = axios.create({
  baseURL: UNIPILE_BASE_URL?.replace(/\/+$/, ''),
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': UNIPILE_API_KEY || '',
    'Access-Token': UNIPILE_API_KEY || '',
  },
  timeout: 30_000,
});

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyRateLimit() {
  const now = Date.now();
  // ensure minimum gap
  const gap = now - lastRequestAt;
  if (gap < MIN_GAP_MS) {
    await delay(MIN_GAP_MS - gap);
  }
  // enforce 60/min
  const cutoff = now - REQUEST_WINDOW_MS;
  while (requestTimestamps.length && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= REQUEST_LIMIT) {
    const waitMs = requestTimestamps[0] + REQUEST_WINDOW_MS - now;
    logger.warn(`[Unipile] Rate cap reached (60/min). Waiting ${waitMs}ms`);
    await delay(waitMs);
  }
  lastRequestAt = Date.now();
  requestTimestamps.push(lastRequestAt);
}

async function requestWithRetry<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  data?: any
): Promise<T> {
  await applyRateLimit();
  const exec = async () => {
    if (method === 'get') return api.get<T>(path);
    if (method === 'delete') return api.delete<T>(path);
    if (method === 'post') return api.post<T>(path, data ?? {});
    return api.put<T>(path, data ?? {});
  };

  try {
    const res = await exec();
    return res.data as T;
  } catch (err: any) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    logger.error(`[Unipile] ${method.toUpperCase()} ${path} failed`, { status, body });

    if (status === 429) {
      // One retry after short backoff; caller should decide whether to stop the sync
      logger.warn('[Unipile] 429 rate limit. Retrying once after 1s...');
      await delay(1000);
      const retryRes = await exec();
      return retryRes.data as T;
    }

    throw err;
  }
}

export async function unipileGet<T = any>(path: string): Promise<T> {
  return requestWithRetry<T>('get', path);
}

export async function unipilePost<T = any>(path: string, body: any): Promise<T> {
  return requestWithRetry<T>('post', path, body);
}

export async function unipilePut<T = any>(path: string, body: any): Promise<T> {
  return requestWithRetry<T>('put', path, body);
}

export async function unipileDelete<T = any>(path: string): Promise<T> {
  return requestWithRetry<T>('delete', path);
}

