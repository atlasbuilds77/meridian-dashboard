/**
 * CSRF Token Hook
 * 
 * Fetches and manages CSRF tokens for protected API requests.
 * Automatically refreshes on mount and provides a refresh function.
 */

import { useState, useEffect, useCallback } from 'react';

interface CsrfTokenState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

export function useCsrfToken() {
  const [state, setState] = useState<CsrfTokenState>({
    token: null,
    loading: true,
    error: null,
  });

  const fetchToken = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/auth/csrf');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      
      const data = await response.json();
      
      setState({
        token: data.token,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('CSRF token fetch failed:', error);
      setState({
        token: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch CSRF token',
      });
    }
  }, []);

  useEffect(() => {
    void fetchToken();
  }, [fetchToken]);

  return {
    token: state.token,
    loading: state.loading,
    error: state.error,
    refresh: fetchToken,
  };
}

/**
 * Helper function to make authenticated API requests with CSRF token
 * Automatically retries once on CSRF_TOKEN_INVALID error
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {},
  csrfToken: string | null
): Promise<Response> {
  if (!csrfToken) {
    throw new Error('CSRF token not available');
  }

  const headers = {
    ...options.headers,
    'x-csrf-token': csrfToken,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If CSRF token is invalid, fetch new token and retry once
  if (response.status === 403) {
    try {
      const errorData = await response.clone().json();
      if (errorData.code === 'CSRF_TOKEN_INVALID') {
        console.warn('CSRF token invalid, refreshing and retrying...');
        
        // Fetch new token
        const csrfResponse = await fetch('/api/auth/csrf');
        const { token: newToken } = await csrfResponse.json();
        
        // Retry with new token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'x-csrf-token': newToken,
          },
        });
      }
    } catch {
      // If parsing fails, return original response
      return response;
    }
  }

  return response;
}
