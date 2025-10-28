// leads.js v24.0
const { readJSON, corsHeaders } = require('./_util.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  }

  const leads = readJSON('leads.json') || [];
  return {
    statusCode:200,
    headers:corsHeaders(),
    body:JSON.stringify({ok:true,leads})
  };
};
