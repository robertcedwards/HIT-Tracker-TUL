export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  isRetryable: boolean;
  userMessage: string;
}

export type ErrorType = 'network' | 'server' | 'client' | 'timeout' | 'auth' | 'quota' | 'unknown';

// Error classification and user-friendly messages
export function classifyError(error: any): ApiError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: error.message,
      code: 'NETWORK_ERROR',
      isRetryable: true,
      userMessage: 'Connection lost. Please check your internet connection and try again.'
    };
  }

  // HTTP errors
  if (error.status) {
    switch (error.status) {
      case 400:
        return {
          message: error.message || 'Bad Request',
          code: 'BAD_REQUEST',
          status: 400,
          isRetryable: false,
          userMessage: 'Invalid request. Please check your input and try again.'
        };
      case 401:
        return {
          message: error.message || 'Unauthorized',
          code: 'UNAUTHORIZED',
          status: 401,
          isRetryable: false,
          userMessage: 'Session expired. Please sign in again.'
        };
      case 403:
        return {
          message: error.message || 'Forbidden',
          code: 'FORBIDDEN',
          status: 403,
          isRetryable: false,
          userMessage: 'Access denied. You don\'t have permission for this action.'
        };
      case 404:
        return {
          message: error.message || 'Not Found',
          code: 'NOT_FOUND',
          status: 404,
          isRetryable: false,
          userMessage: 'The requested resource could not be found.'
        };
      case 429:
        return {
          message: error.message || 'Too Many Requests',
          code: 'RATE_LIMITED',
          status: 429,
          isRetryable: true,
          userMessage: 'Too many requests. Please wait a moment before trying again.'
        };
      case 500:
        return {
          message: error.message || 'Internal Server Error',
          code: 'SERVER_ERROR',
          status: 500,
          isRetryable: true,
          userMessage: 'Server error. Please try again in a few moments.'
        };
      case 502:
      case 503:
      case 504:
        return {
          message: error.message || 'Service Unavailable',
          code: 'SERVICE_UNAVAILABLE',
          status: error.status,
          isRetryable: true,
          userMessage: 'Service temporarily unavailable. Please try again later.'
        };
      default:
        return {
          message: error.message || 'HTTP Error',
          code: 'HTTP_ERROR',
          status: error.status,
          isRetryable: error.status >= 500,
          userMessage: `Request failed (${error.status}). Please try again.`
        };
    }
  }

  // Supabase errors
  if (error.code) {
    switch (error.code) {
      case 'PGRST116':
        return {
          message: error.message,
          code: 'ROW_LEVEL_SECURITY',
          isRetryable: false,
          userMessage: 'Access denied. Please check your permissions.'
        };
      case '23505':
        return {
          message: error.message,
          code: 'DUPLICATE_KEY',
          isRetryable: false,
          userMessage: 'This item already exists. Please try a different name.'
        };
      case '23503':
        return {
          message: error.message,
          code: 'FOREIGN_KEY_VIOLATION',
          isRetryable: false,
          userMessage: 'Cannot delete this item because it\'s being used elsewhere.'
        };
      default:
        return {
          message: error.message,
          code: error.code,
          isRetryable: false,
          userMessage: 'Database error. Please try again or contact support.'
        };
    }
  }

  // Timeout errors
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return {
      message: error.message,
      code: 'TIMEOUT',
      isRetryable: true,
      userMessage: 'Request timed out. Please try again.'
    };
  }

  // Default error
  return {
    message: error.message || 'Unknown error',
    code: 'UNKNOWN_ERROR',
    isRetryable: false,
    userMessage: 'An unexpected error occurred. Please try again.'
  };
}

// Retry configuration
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: ApiError) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryCondition: (error) => error.isRetryable
};

// Exponential backoff delay calculation
function calculateDelay(attempt: number, options: RetryOptions): number {
  const delay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelay);
}

// Sleep utility for delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main retry wrapper function
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: ApiError;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = classifyError(error);
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt > opts.maxRetries || !opts.retryCondition!(lastError)) {
        throw lastError;
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, opts);
      console.warn(`API call failed (attempt ${attempt}/${opts.maxRetries + 1}). Retrying in ${delay}ms...`, lastError);
      await sleep(delay);
    }
  }

  throw lastError!;
}

// DSLD API specific error handler
export async function handleDsldApiCall<T>(
  apiCall: () => Promise<Response>
): Promise<T> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await apiCall();
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        // Special handling for DSLD API errors
        if (response.status === 404) {
          throw {
            status: 404,
            message: 'No supplements found matching your search criteria.'
          };
        }
        
        if (response.status === 500) {
          throw {
            status: 500,
            message: 'DSLD database is temporarily unavailable. Please try again later.'
          };
        }

        throw {
          status: response.status,
          message: `DSLD API error: ${response.status} ${errorText}`
        };
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, {
    maxRetries: 2, // Fewer retries for external API
    baseDelay: 2000, // Longer delay for external API
    retryCondition: (error) => 
      error.isRetryable && 
      error.status !== 404 && // Don't retry 404s
      error.status !== 400    // Don't retry bad requests
  });
}

// Supabase operation wrapper
export async function handleSupabaseOperation<T>(
  operation: () => Promise<{ data: T; error: any }>
): Promise<T> {
  return withRetry(async () => {
    const { data, error } = await operation();
    
    if (error) {
      throw error;
    }
    
    return data;
  }, {
    maxRetries: 2,
    retryCondition: (error) => 
      error.isRetryable && 
      !['PGRST116', '23505', '23503'].includes(error.code || '') // Don't retry RLS, duplicate key, or FK violations
  });
}

// User-friendly error notification helper
export function getErrorMessage(error: any): string {
  if (error.userMessage) {
    return error.userMessage;
  }
  
  const classified = classifyError(error);
  return classified.userMessage;
}

// Log error for debugging (can be extended to send to monitoring service)
export function logError(error: any, context: string) {
  const classified = classifyError(error);
  console.error(`[${context}] API Error:`, {
    code: classified.code,
    status: classified.status,
    message: classified.message,
    isRetryable: classified.isRetryable,
    timestamp: new Date().toISOString()
  });
} 