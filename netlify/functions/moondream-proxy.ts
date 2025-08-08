// Netlify function handler

// Clean up the API URL to remove any HTTP method prefixes
const rawApiUrl = process.env.VITE_MOONDREAM_API_URL || 'https://api.moondream.ai/v1';
const MOONDREAM_API_URL = rawApiUrl.replace(/^(GET|POST|PUT|DELETE)\s+/i, '').trim();
// Try both VITE_ prefixed and non-prefixed versions for flexibility
const MOONDREAM_API_KEY = process.env.VITE_MOONDREAM_API_KEY || process.env.MOONDREAM_API_KEY;

export const handler = async (event: any, context: any) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check if API key is configured
  if (!MOONDREAM_API_KEY) {
    console.error('API Key not found. Environment variables:');
    console.error('- VITE_MOONDREAM_API_KEY:', process.env.VITE_MOONDREAM_API_KEY ? 'EXISTS' : 'NOT FOUND');
    console.error('- MOONDREAM_API_KEY:', process.env.MOONDREAM_API_KEY ? 'EXISTS' : 'NOT FOUND');
    console.error('- All env vars:', Object.keys(process.env).filter(key => key.includes('MOONDREAM')));
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Moondream API key not configured',
        debug: {
          viteKeyExists: !!process.env.VITE_MOONDREAM_API_KEY,
          plainKeyExists: !!process.env.MOONDREAM_API_KEY,
          availableKeys: Object.keys(process.env).filter(key => key.includes('MOONDREAM'))
        }
      }),
    };
  }

  try {
    // Debug: Log environment variables
    console.log('Raw API URL from env:', rawApiUrl);
    console.log('Cleaned API URL:', MOONDREAM_API_URL);
    console.log('API Key configured:', !!MOONDREAM_API_KEY);
    console.log('API Key length:', MOONDREAM_API_KEY ? MOONDREAM_API_KEY.length : 0);
    console.log('API Key prefix:', MOONDREAM_API_KEY ? MOONDREAM_API_KEY.substring(0, 10) + '...' : 'undefined');
    console.log('VITE_MOONDREAM_API_KEY exists:', !!process.env.VITE_MOONDREAM_API_KEY);
    console.log('MOONDREAM_API_KEY exists:', !!process.env.MOONDREAM_API_KEY);
    console.log('All env vars starting with VITE_:', Object.keys(process.env).filter(key => key.startsWith('VITE_')));
    console.log('All env vars starting with MOONDREAM:', Object.keys(process.env).filter(key => key.startsWith('MOONDREAM')));
    
    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    const { image_url, question } = body;

    // Validate required fields
    if (!image_url || !question) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: image_url and question' }),
      };
    }

    // Make request to Moondream API
    const apiUrl = `${MOONDREAM_API_URL}/query`;
    console.log('Making request to:', apiUrl);
    console.log('Request headers:', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOONDREAM_API_KEY ? '***' + MOONDREAM_API_KEY.substring(MOONDREAM_API_KEY.length - 4) : 'undefined'}`
    });
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Moondream-Auth': `${MOONDREAM_API_KEY}`,
    };
    
    console.log('Actual request headers being sent:', requestHeaders);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        image_url,
        question,
      }),
    });

    if (!response.ok) {
      // Get error details from Moondream API
      let errorDetails = '';
      try {
        const errorData = await response.text();
        errorDetails = ` - ${errorData}`;
        console.log('Moondream API error response:', errorData);
      } catch (e) {
        errorDetails = ` - ${response.statusText}`;
        console.log('Moondream API error response (text failed):', response.statusText);
      }

      console.log('Full error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        errorDetails
      });

      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Moondream API error: ${response.status}${errorDetails}` 
        }),
      };
    }

    // Return the Moondream API response
    const data = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('Moondream proxy error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}; 