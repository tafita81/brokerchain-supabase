const { pushLead, corsHeaders } = require('./_util.js');
const { v4: uuidv4 } = require('uuid');

function guessCategory(needText="") {
  const t = needText.toLowerCase();
  if (t.includes("roof") || t.includes("hail") || t.includes("leak")) return "roofing";
  if (t.includes("flood") || t.includes("water") || t.includes("pump")) return "water-mitigation";
  if (t.includes("ac") || t.includes("hvac") || t.includes("air conditioning") || t.includes("plumbing")) return "hvac-plumbing";
  if (t.includes("generator") || t.includes("power")) return "power-gen";
  return "general";
}

function pickTenant(buyer_type="", needText="") {
  if (buyer_type === "public") return "federal-micro-purchase-fastlane";
  const t = needText.toLowerCase();
  if (t.includes("pump") || t.includes("generator") || t.includes("spill kit") || t.includes("under $15k")) {
    return "federal-micro-purchase-fastlane";
  }
  return "emergency-dispatch-exchange";
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body||"{}");
      const lead = {
        id: uuidv4(),
        zip: body.zip || "",
        need: body.need || "",
        urgency: body.urgency || "today",
        buyer_type: body.buyer_type || "business",
        email: body.email || "",
        phone: body.phone || "",
        category: guessCategory(body.need || ""),
        tenant: pickTenant(body.buyer_type || "", body.need || ""),
        sale_ready: true,
        source: body.source || "form",
        created_utc: new Date().toISOString(),
        status: "new"
      };
      pushLead(lead);
      return { statusCode:200, headers:corsHeaders(), body:JSON.stringify({ok:true, lead}) };
    } catch (err) {
      return { statusCode:500, headers:corsHeaders(), body:JSON.stringify({ok:false, error:err.message}) };
    }
  }

  return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
};
