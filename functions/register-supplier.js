const { pushSupplier, corsHeaders } = require('./_util.js');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body||"{}");
      const supplier = {
        id: uuidv4(),
        business_name: body.business_name || "Unknown Business",
        contact_name: body.contact_name || "Ops",
        email: body.email || "",
        phone24h: body.phone24h || "",
        categories: body.categories || [],
        coverage_zip_regions: body.coverage_zip_regions || "",
        billing_pref: body.billing_pref || "stripe_per_job_dispatch",
        geo: body.geo || "US",
        source: body.source || "form",
        created_utc: new Date().toISOString()
      };
      pushSupplier(supplier);
      return { statusCode:200, headers:corsHeaders(), body:JSON.stringify({ok:true, supplier}) };
    } catch (err) {
      return { statusCode:500, headers:corsHeaders(), body:JSON.stringify({ok:false, error:err.message}) };
    }
  }

  if (event.httpMethod === 'GET') {
    const { readJSON } = require('./_util.js');
    const suppliers = readJSON('suppliers.json') || [];
    return { statusCode:200, headers:corsHeaders(), body:JSON.stringify({suppliers}) };
  }

  return {statusCode:405, headers:corsHeaders(), body:'Method Not Allowed'};
};
