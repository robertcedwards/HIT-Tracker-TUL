// Netlify function handler

const MOONDREAM_API_URL = process.env.VITE_MOONDREAM_API_URL || 'https://api.moondream.ai/v1';
const MOONDREAM_API_KEY = process.env.VITE_MOONDREAM_API_KEY;

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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Moondream API key not configured' }),
    };
  }

  try {
    // Debug: Log environment variables
    console.log('MOONDREAM_API_URL:', MOONDREAM_API_URL);
    console.log('API Key configured:', !!MOONDREAM_API_KEY);
    
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
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOONDREAM_API_KEY}`,
      },
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
      } catch (e) {
        errorDetails = ` - ${response.statusText}`;
      }

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