// email-inbox.js v18.1
// Converte e-mail recebido em lead urgente.
// INBOX_ENABLED deve estar true no settings.json

const { readJSON, pushLead, corsHeaders } = require('./_util.js');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  }

  const settings = readJSON('settings.json') || {};
  if (!settings.INBOX_ENABLED) {
    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true, skipped:true, reason:"INBOX_DISABLED"})
    };
  }

  // mock de e-mail vindo de órgão público / utility
  const mockMail = {
    from: "procurement@city-ga.gov",
    text: "We need 3 portable pumps for flood control, under $15k total, delivery by Friday. We're authorized to card this under emergency purchase.",
    zip: "30303",
    urgency: "today",
    buyer_type: "public",
    state: "GA"
  };

  const id = uuidv4();
  const lower = (mockMail.text||"").toLowerCase();

  let category = "general-emergency";
  if (lower.includes("roof") || lower.includes("tarp")) category = "roofing-emergency";
  else if (lower.includes("flood") || lower.includes("pump")) category = "water-mitigation";
  else if (lower.includes("generator")) category = "power-generation";
  else if (lower.includes("hvac") || lower.includes("cool")) category = "hvac-failure";

  const tenant = (mockMail.buyer_type === "public")
    ? "federal-micro-purchase-fastlane"
    : "emergency-dispatch-exchange";

  // autorização <15k
  let authorized_under_15k = "unknown";
  const authCheck = lower.includes("under $15k")
    || lower.includes("authorized to card")
    || lower.includes("micro-purchase")
    || lower.includes("purchase card");
  if (mockMail.buyer_type === "public" && authCheck) {
    authorized_under_15k = true;
  }

  const nowIso = new Date().toISOString();

  const leadObj = {
    id,
    zip: mockMail.zip,
    state: mockMail.state || "",
    need: mockMail.text,
    urgency: mockMail.urgency,
    buyer_type: mockMail.buyer_type,
    email: mockMail.from || "",
    phone: "",
    category,
    tenant,
    authorized_under_15k,
    source_channel: "inbox-email",
    sale_ready: false,
    source: "inbox",
    created_utc: nowIso,
    ingested_from_inbox_utc: nowIso,
    status: "scraped"
  };

  pushLead(leadObj);

  return {
    statusCode:200,
    headers:corsHeaders(),
    body:JSON.stringify({ok:true, ingested:leadObj})
  };
};
