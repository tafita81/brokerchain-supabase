// manual-lead.js v27.0 - COM SUPABASE
const { createLead, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    const lead = {
      buyer_type: body.buyer_type || 'public',
      state: body.state || '?',
      urgency: body.urgency || 'unknown',
      tenant: body.tenant || 'federal-micro-purchase-fastlane',
      authorized_under_15k: !!body.authorized_under_15k,
      contact_email: body.contact_email || '',
      contact_phone: body.contact_phone || '',
      title: body.title || '',
      body: body.need || body.body || '',
      need: body.need || '',
      category: body.category || 'general',
      zip: body.zip || '00000',
      source_channel: 'manual',
      status: 'scraped',
      sale_ready: false
    };

    const created = await createLead(lead);
    
    if (created) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, lead: created })
      };
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: 'Failed to create lead (duplicate?)' })
      };
    }
  } catch (error) {
    console.error('Manual lead error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
