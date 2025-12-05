/**
 * Unipile API Client
 * Wrapper around axios for Unipile API calls
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { UNIPILE_BASE_URL, UNIPILE_API_KEY } from '../config/unipile';
import { logger } from '../utils/logger';

// Create axios instance with Unipile configuration
export const unipileClient: AxiosInstance = axios.create({
  baseURL: UNIPILE_BASE_URL,
  headers: {
    'X-API-KEY': UNIPILE_API_KEY, // Unipile uses X-API-KEY header, not Bearer token
    'Content-Type': 'application/json',
    'accept': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor for logging
unipileClient.interceptors.request.use(
  (config) => {
    logger.info(`[Unipile] ${config.method?.toUpperCase()} ${config.url}`);
    logger.info(`[Unipile] Request body:`, JSON.stringify(config.data, null, 2));
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
    logger.info(`[Unipile] Response body:`, JSON.stringify(response.data, null, 2));
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      logger.error(`[Unipile] Error ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
      logger.error(`[Unipile] Error headers:`, JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      logger.error('[Unipile] No response received:', error.message);
    } else {
      logger.error('[Unipile] Error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Helper: GET request
 */
export async function unipileGet<T>(url: string, params?: any): Promise<T> {
  try {
    const response = await unipileClient.get<T>(url, { params });
    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`API request failed: ${errorMsg}`);
  }
}

/**
 * Helper: POST request
 */
export async function unipilePost<T>(url: string, data?: any): Promise<T> {
  try {
    const response = await unipileClient.post<T>(url, data);
    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
    // Remove "Unipile" from error messages for user-facing display
    const cleanError = errorMsg.replace(/Unipile\s+/gi, '');
    throw new Error(`API request failed: ${cleanError}`);
  }
}

/**
 * Helper: PUT request
 */
export async function unipilePut<T>(url: string, data?: any): Promise<T> {
  try {
    const response = await unipileClient.put<T>(url, data);
    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`API request failed: ${errorMsg}`);
  }
}

/**
 * Helper: DELETE request
 */
export async function unipileDelete<T>(url: string): Promise<T> {
  try {
    const response = await unipileClient.delete<T>(url);
    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`API request failed: ${errorMsg}`);
  }
}

/**
 * Type definitions for Unipile API responses
 */

export interface UnipileAccount {
  id: string;
  provider: string; // 'LINKEDIN'
  email?: string;
  name?: string;
  username?: string;
  profile_picture?: string;
  is_active: boolean;
  created_at: string;
}

export interface UnipileConversation {
  id: string;
  account_id: string;
  participants: UnipileParticipant[];
  last_message?: {
    id: string;
    text: string;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface UnipileParticipant {
  id: string;
  name: string;
  profile_url?: string;
  profile_picture?: string;
}

export interface UnipileMessage {
  id: string;
  conversation_id: string;
  account_id: string;
  sender: UnipileParticipant;
  text: string;
  attachments?: UnipileAttachment[];
  created_at: string;
  is_from_me: boolean;
}

export interface UnipileAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
}

export interface UnipileAuthSession {
  url: string;
  session_id: string;
  expires_at: string;
}

export interface UnipileSendMessageRequest {
  account_id: string;
  conversation_id?: string;
  recipient_id?: string; // For new conversations
  text: string;
  attachments?: {
    url: string;
    name: string;
  }[];
}

export interface UnipileSendMessageResponse {
  message_id: string;
  conversation_id: string;
  created_at: string;
}
