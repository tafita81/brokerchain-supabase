const { readJSON, writeJSON, corsHeaders } = require('./_util.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod === 'GET') {
    const tenants = readJSON('tenants.json') || [];
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ tenants })
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || "{}");
      const tenants = readJSON('tenants.json') || [];
      const newTenant = {
        id: body.id || ('tenant-' + Date.now()),
        name: body.name || 'Unnamed Tenant',
        buyer_token_prefix: body.buyer_token_prefix || 'GEN-',
        voice_tone: body.voice_tone || 'direct, human, calm, no fluff',
        offer_type: body.offer_type || 'generic',
        billing_model: body.billing_model || 'stripe_per_lead',
        geo: body.geo || 'US',
        ticket_estimated: body.ticket_estimated || '',
        notes: body.notes || ''
      };
      tenants.push(newTenant);
      writeJSON('tenants.json', tenants);
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok:true, tenant:newTenant })
      };
    } catch (err) {
      return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ ok:false, error:err.message }) };
    }
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const body = JSON.parse(event.body || "{}");
      const tenants = readJSON('tenants.json') || [];
      const idx = tenants.findIndex(t => t.id === body.id);
      if (idx === -1) {
        return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ ok:false, error:'not found' }) };
      }
      tenants[idx] = { ...tenants[idx], ...body };
      writeJSON('tenants.json', tenants);
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok:true, tenant:tenants[idx] })
      };
    } catch (err) {
      return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ ok:false, error:err.message }) };
    }
  }

  return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
};
