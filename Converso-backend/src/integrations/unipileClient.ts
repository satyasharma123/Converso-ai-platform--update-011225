/**
 * Unipile API Client
 * HTTP client wrapper for Unipile API calls
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { UNIPILE_BASE_URL, UNIPILE_API_KEY } from '../config/unipile';
import { logger } from '../utils/logger';

export const unipileClient: AxiosInstance = axios.create({
  baseURL: UNIPILE_BASE_URL,
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'Content-Type': 'application/json',
    'accept': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor for logging
unipileClient.interceptors.request.use(
  (config) => {
    logger.info(`[Unipile] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    logger.error('[Unipile] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
unipileClient.interceptors.response.use(
  (response) => {
    logger.info(`[Unipile] Response ${response.status} from ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      logger.error(`[Unipile] Error ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      logger.error('[Unipile] No response received:', error.request);
    } else {
      logger.error('[Unipile] Request setup error:', (error as any)?.message || error);
    }
    
    const errorMsg = (error.response?.data as any)?.message || (error as any)?.message || 'Unknown error';
    throw new Error(`API request failed: ${errorMsg}`);
  }
);

// Helper functions for common operations
export async function unipileGet<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
  const response = await unipileClient.get<T>(endpoint, { params });
  return response.data;
}

export async function unipilePost<T>(endpoint: string, data?: any): Promise<T> {
  const response = await unipileClient.post<T>(endpoint, data);
  return response.data;
}

export async function unipileDelete<T>(endpoint: string): Promise<T> {
  const response = await unipileClient.delete<T>(endpoint);
  return response.data;
}

export async function unipilePatch<T>(endpoint: string, data?: any): Promise<T> {
  const response = await unipileClient.patch<T>(endpoint, data);
  return response.data;
}




