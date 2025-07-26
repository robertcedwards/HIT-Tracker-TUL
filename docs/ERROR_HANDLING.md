# Error Handling System

## Overview

The Hit Flow application includes a comprehensive error handling system designed to provide better user experience, improved debugging, and robust API call management with automatic retry logic.

## Key Features

- **Smart Error Classification**: Automatically categorizes errors by type (network, server, client, timeout, auth, etc.)
- **User-Friendly Messages**: Converts technical errors into clear, actionable messages for users
- **Automatic Retry Logic**: Implements exponential backoff for retryable errors
- **Centralized Logging**: Structured error logging for debugging and monitoring
- **API-Specific Handlers**: Specialized handling for different APIs (DSLD, Supabase)

## Architecture

### Core Components

1. **Error Classification (`classifyError`)**: Analyzes errors and provides structured information
2. **Retry Wrapper (`withRetry`)**: Implements retry logic with exponential backoff
3. **API-Specific Handlers**: Tailored error handling for different services
4. **User Message Helper (`getErrorMessage`)**: Extracts user-friendly error messages

## Usage Examples

### Basic Error Handling

```typescript
import { getErrorMessage, logError } from '../lib/errorHandling';

try {
  const result = await someApiCall();
} catch (error) {
  logError(error, 'someApiCall');
  const userMessage = getErrorMessage(error);
  setError(userMessage);
}
```

### DSLD API Calls

```typescript
import { handleDsldApiCall } from '../lib/errorHandling';

const data = await handleDsldApiCall<SearchResults>(() =>
  fetch(`/.netlify/functions/dsld-proxy?q=${query}`)
);
```

### Supabase Operations

```typescript
import { handleSupabaseOperation } from '../lib/errorHandling';

const data = await handleSupabaseOperation(async () =>
  supabase
    .from('table')
    .select('*')
    .eq('id', id)
);
```

### Custom Retry Logic

```typescript
import { withRetry } from '../lib/errorHandling';

const result = await withRetry(
  () => unstableApiCall(),
  {
    maxRetries: 5,
    baseDelay: 2000,
    retryCondition: (error) => error.status >= 500
  }
);
```

## Error Types and Handling

### Network Errors
- **Condition**: Connection failures, DNS issues
- **Retry**: ✅ Automatic with exponential backoff
- **User Message**: "Connection lost. Please check your internet connection and try again."

### HTTP Status Codes

| Status | Retry | User Message |
|--------|-------|--------------|
| 400 | ❌ | "Invalid request. Please check your input and try again." |
| 401 | ❌ | "Session expired. Please sign in again." |
| 403 | ❌ | "Access denied. You don't have permission for this action." |
| 404 | ❌ | "The requested resource could not be found." |
| 429 | ✅ | "Too many requests. Please wait a moment before trying again." |
| 500+ | ✅ | "Server error. Please try again in a few moments." |

### Database Errors (Supabase)

| Code | Type | Retry | Description |
|------|------|-------|-------------|
| PGRST116 | RLS Violation | ❌ | Row Level Security denial |
| 23505 | Duplicate Key | ❌ | Unique constraint violation |
| 23503 | Foreign Key | ❌ | Referenced record doesn't exist |

### Timeout Errors
- **Condition**: Request takes longer than configured timeout
- **Retry**: ✅ Automatic retry with longer delays
- **User Message**: "Request timed out. Please try again."

## Configuration

### Default Retry Settings

```typescript
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 10000,      // 10 seconds
  backoffMultiplier: 2,
  retryCondition: (error) => error.isRetryable
};
```

### DSLD API Settings

```typescript
// DSLD-specific configuration
{
  maxRetries: 2,        // Fewer retries for external API
  baseDelay: 2000,      // Longer initial delay
  retryCondition: (error) => 
    error.isRetryable && 
    error.status !== 404 && 
    error.status !== 400
}
```

### Supabase Settings

```typescript
// Supabase-specific configuration
{
  maxRetries: 2,
  retryCondition: (error) => 
    error.isRetryable && 
    !['PGRST116', '23505', '23503'].includes(error.code)
}
```

## Error Logging

All errors are logged with structured information:

```typescript
{
  code: 'NETWORK_ERROR',
  status: undefined,
  message: 'Failed to fetch',
  isRetryable: true,
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

### Log Contexts

- `handleSearch`: Manual supplement search
- `handleBarcodeSearch`: Barcode-based search
- `handleAddUserSupplement`: Adding supplement to user list
- `handleAddDsldSupplement`: Adding DSLD supplement
- `handleAddCustomSupplement`: Adding custom supplement
- `searchSupplements`: Local database search
- `addSupplement`: Adding to supplements table
- `getUserSupplements`: Fetching user's supplement list

## Best Practices

### 1. Always Use Context
```typescript
logError(error, 'specificFunctionName');
```

### 2. Show User-Friendly Messages
```typescript
const userMessage = getErrorMessage(error);
setError(userMessage); // Never show technical error messages
```

### 3. Handle Non-Retryable Errors Gracefully
```typescript
try {
  await operation();
} catch (error) {
  if (error.code === 'DUPLICATE_KEY') {
    // Handle duplicate case specifically
    setError('This item already exists.');
    return;
  }
  throw error; // Let other errors bubble up
}
```

### 4. Don't Retry User Errors
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- Validation errors
- Duplicate key violations

### 5. Use Appropriate Timeouts
- DSLD API: 10 seconds (external service)
- Supabase: Default (internal service)
- Long operations: Custom timeout

## Testing Error Scenarios

### Simulating Network Errors
```typescript
// Temporarily disable network
navigator.onLine = false;
```

### Simulating Server Errors
```typescript
// Mock fetch to return 500
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: false,
    status: 500,
    text: () => Promise.resolve('Internal Server Error')
  })
);
```

### Testing Retry Logic
```typescript
let callCount = 0;
const unstableFunction = () => {
  callCount++;
  if (callCount < 3) {
    throw new Error('Temporary failure');
  }
  return 'success';
};

const result = await withRetry(unstableFunction);
// Should succeed after 3 attempts
```

## Monitoring and Alerts

The error handling system is designed to integrate with monitoring services:

```typescript
export function logError(error: any, context: string) {
  const classified = classifyError(error);
  
  // Console logging for development
  console.error(`[${context}] API Error:`, classified);
  
  // TODO: Send to monitoring service
  // analytics.track('api_error', {
  //   context,
  //   code: classified.code,
  //   status: classified.status,
  //   retryable: classified.isRetryable
  // });
}
```

## Future Enhancements

1. **Circuit Breaker Pattern**: Temporarily disable failing services
2. **Error Budgets**: Track error rates and alert on degradation
3. **User Error Reporting**: Allow users to report issues directly
4. **Offline Support**: Queue operations when network is unavailable
5. **Progressive Degradation**: Fallback to cached data when APIs fail 