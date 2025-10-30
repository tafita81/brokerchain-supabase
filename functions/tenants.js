// tenants.js v27.0 - COM SUPABASE
const { getTenants, createTenant, updateTenant, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const tenants = await getTenants();
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ tenants })
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || "{}");
      const newTenant = {
        id: body.id,
        name: body.name || 'Unnamed Tenant',
        description: body.description || '',
        config: body.config || {},
        active: body.active !== undefined ? body.active : true
      };
      
      const created = await createTenant(newTenant);
      
      if (created) {
        return {
          statusCode: 200,
          headers: corsHeaders(),
          body: JSON.stringify({ ok:true, tenant:created })
        };
      } else {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ ok:false, error:'Failed to create tenant' })
        };
      }
    }

    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body || "{}");
      
      if (!body.id) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ ok:false, error:'Tenant ID required' })
        };
      }
      
      const updated = await updateTenant(body.id, body);
      
      if (updated) {
        return {
          statusCode: 200,
          headers: corsHeaders(),
          body: JSON.stringify({ ok:true, tenant:updated })
        };
      } else {
        return {
          statusCode: 404,
          headers: corsHeaders(),
          body: JSON.stringify({ ok:false, error:'Tenant not found' })
        };
      }
    }

    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  } catch (error) {
    console.error('Tenants error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
