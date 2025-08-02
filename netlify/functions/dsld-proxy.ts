const DSLD_API_KEY = process.env.DSLD_API_KEY;
const BASE_URL = 'https://api.ods.od.nih.gov/dsld/v9';

export const handler = async function(event: any, context: any) {
  const { type, q, dsldId } = event.queryStringParameters || {};

  if (!DSLD_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'DSLD_API_KEY not set in environment' })
    };
  }

  try {
    let url = '';
    let headers = { 'X-API-KEY': DSLD_API_KEY };
    let result;

    if (type === 'search' && typeof q === 'string') {
      url = `${BASE_URL}/browse-products/?method=by_keyword&q=${encodeURIComponent(q)}`;
      result = await fetch(url, { headers });
      const data = await result.json();
      return {
        statusCode: 200,
        body: JSON.stringify(data)
      };
    }
    if (type === 'label' && typeof dsldId === 'string') {
      url = `${BASE_URL}/label/${encodeURIComponent(dsldId)}`;
      result = await fetch(url, { headers });
      const data = await result.json();
      return {
        statusCode: 200,
        body: JSON.stringify(data)
      };
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request parameters' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
    };
  }
}; 