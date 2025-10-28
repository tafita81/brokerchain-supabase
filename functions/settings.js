// settings.js v27.0 - COM SUPABASE
const { getSettings, updateSetting, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const settings = await getSettings();
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, settings })
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      for (const [key, value] of Object.entries(body)) {
        await updateSetting(key, value);
      }
      
      const settings = await getSettings();
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, settings })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: 'Method Not Allowed'
    };
  } catch (error) {
    console.error('Settings error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
