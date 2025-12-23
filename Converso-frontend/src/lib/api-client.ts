/**
 * API Client for Backend Express Server
 * Handles all HTTP requests to the backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ApiError {
  error: {
    message: string;
    statusCode?: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Detect FormData - browser will set Content-Type with boundary automatically
    const isFormData = options.body instanceof FormData;
    
    const headers: HeadersInit = {
      // Only set JSON Content-Type if NOT FormData
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    // Get auth token from localStorage (Supabase stores it with a specific key)
    // Try to get from the Supabase session storage
    let token: string | null = null;
    let userData: any = null;

    // Get Supabase session from localStorage
    // Supabase stores session with key pattern: sb-{project-ref}-auth-token
    const supabaseKey = 'sb-wahvinwuyefmkmgmjspo-auth-token';
    const sessionStr = localStorage.getItem(supabaseKey);
    
    if (sessionStr) {
      try {
        const parsed = JSON.parse(sessionStr);
        token = parsed?.access_token || null;
        userData = parsed?.user || null;
      } catch {
        // Ignore parse errors
      }
    }

    // Add auth token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add user context headers if available
    if (userData?.id) {
      headers['x-user-id'] = userData.id;
    }

    if (userData?.user_metadata?.role) {
      headers['x-user-role'] = userData.user_metadata.role;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: {
          message: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        },
      }));
      throw new Error(error.error?.message || 'Request failed');
    }

    const data = await response.json();
    return data.data || data; // Backend returns { data: ... } format
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * POST with FormData (for file uploads)
   * Browser automatically sets Content-Type with multipart boundary
   */
  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

