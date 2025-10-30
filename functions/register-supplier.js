// register-supplier.js v27.0 - COM SUPABASE
const { createSupplier, getSuppliers, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body||"{}");
      const supplier = {
        business_name: body.business_name || "Unknown Business",
        name: body.contact_name || body.business_name || "Ops",
        email: body.email || "",
        phone: body.phone || "",
        phone24h: body.phone24h || body.phone || "",
        categories: body.categories || [],
        state: body.state || body.geo || "US",
        states_served: body.states_served || [],
        billing_pref: body.billing_pref || "card",
        active: true
      };
      
      const created = await createSupplier(supplier);
      
      if (created) {
        return { 
          statusCode:200, 
          headers:corsHeaders(), 
          body:JSON.stringify({ok:true, supplier:created}) 
        };
      } else {
        return {
          statusCode:400,
          headers:corsHeaders(),
          body:JSON.stringify({ok:false, error:'Failed to create supplier'})
        };
      }
    }

    if (event.httpMethod === 'GET') {
      const suppliers = await getSuppliers();
      return { 
        statusCode:200, 
        headers:corsHeaders(), 
        body:JSON.stringify({suppliers}) 
      };
    }

    return {statusCode:405, headers:corsHeaders(), body:'Method Not Allowed'};
  } catch (error) {
    console.error('Register supplier error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
