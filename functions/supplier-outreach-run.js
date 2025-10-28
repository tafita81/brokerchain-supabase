// supplier-outreach-run.js v25.0
// Ping diário pros fornecedores ativos perguntando disponibilidade hoje.
// Só dispara se você já habilitou outreach (APPROVED_OUTREACH=true),
// e se e-mail/produção estão prontos. Evita mandar mensagem sem sua autorização.

const { readJSON, writeJSON, corsHeaders } = require('./_util.js');
const nodemailer = require('nodemailer');

function buildTransportFromEnv(){
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if(!host || !user || !pass){
    return null;
  }
  return nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    auth: { user, pass }
  });
}

function buildMessage(supplier){
  const subject = "Standby check – availability today?";
  const text = [
    "Hi,",
    "",
    "Quick check-in. Are you available TODAY for:",
    supplier.capability || "emergency work",
    "in " + (supplier.state || "your area") + "?",
    "",
    "We’re lining up urgent jobs.",
    "Reply YES or NO and best phone.",
    "",
    "- Sales"
  ].join("\n");

  return { subject, text };
}

async function sendPingEmailsIfAllowed(){
  const settings = readJSON('settings.json') || {};
  const suppliers = readJSON('suppliers.json') || [];

  if(!settings.PRODUCTION_READY){
    return {sent:0, reason:"production_not_ready"};
  }
  if(!settings.EMAIL_READY){
    return {sent:0, reason:"email_not_ready"};
  }
  if(!settings.APPROVED_OUTREACH){
    return {sent:0, reason:"outreach_not_approved"};
  }
  if(!settings.DAILY_SUPPLIER_PING_ENABLED){
    return {sent:0, reason:"daily_ping_disabled"};
  }

  const transport = buildTransportFromEnv();
  if(!transport){
    return {sent:0, reason:"smtp_missing_env"};
  }

  let sentCount=0;
  for(const s of suppliers){
    if(!s.active) continue;
    if(!s.contact_email) continue;

    const {subject, text} = buildMessage(s);

    try {
      await transport.sendMail({
        from: process.env.SMTP_USER,
        to: s.contact_email,
        subject,
        text
      });
      s.last_update_utc = new Date().toISOString();
      sentCount++;
    } catch(e){
      // Falha no envio específico não derruba os outros
      console.error("Send failed for supplier", s.id, e);
    }
  }

  writeJSON('suppliers.json', suppliers);
  return {sent: sentCount, reason:"ok"};
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {statusCode:200, headers:corsHeaders(), body:''};
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {statusCode:405, headers:corsHeaders(), body:'Method Not Allowed'};
  }

  const result = await sendPingEmailsIfAllowed();

  return {
    statusCode:200,
    headers:corsHeaders(),
    body:JSON.stringify({
      ok:true,
      outreach_result: result
    })
  };
};
