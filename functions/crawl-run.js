// crawl-run.js v25.0
// Captura páginas públicas de emergência / procurement / utilidades nos EUA,
// extrai contatos e necessidade urgente, gera leads e atualiza buyers.json.

const { readJSON, writeJSON, corsHeaders, pushLead } = require('./_util.js');

async function download(url){
  const resp = await fetch(url, { method: "GET" });
  const txt = await resp.text();
  return txt;
}

function extractFromHtml(html){
  const txt = html
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const emails = Array.from(new Set(
    (txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])
  ));
  const phones = Array.from(new Set(
    (txt.match(/(\(?\d{3}\)?[\s-]\d{3}[\s-]\d{4})/g)||[])
  ));

  let urgency="this-week";
  if(/within\s+2\s*hours|within\s+1\s*hour|1[-\s]*2h|2h\s*response|immediately|asap|right\s+now/i.test(txt)){
    urgency="1-2h";
  } else if(/today|same\s*day|24\/7|24-7|24x7/i.test(txt)){
    urgency="today";
  }

  let authorized_under_15k=false;
  if(/micro[- ]?purchase|under\s*\$?15 ?k|under\s*\$?15000|purchase\s*card/i.test(txt)){
    authorized_under_15k=true;
  }

  let category="general-emergency";
  if(/generator|backup power|emergency power/i.test(txt)){
    category="generator";
  } else if(/pump|pumping|dewater|flood/i.test(txt)){
    category="flood-pump";
  } else if(/roof|roofing|tarp/i.test(txt)){
    category="roof-repair";
  } else if(/HVAC|air\s*conditioning|cooling/i.test(txt)){
    category="hvac";
  } else if(/solar|pv system|photovoltaic/i.test(txt)){
    category="solar-backup";
  }

  return {
    txt,
    emails,
    phones,
    urgency,
    authorized_under_15k,
    category
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  }

  const settings = readJSON('settings.json') || {};
  if(!settings.CRAWLER_ENABLED){
    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true, skipped:true, reason:"CRAWLER_ENABLED=false"})
    };
  }

  const cq = readJSON('crawler-queue.json') || [];
  const leadsCreated = [];
  let sourcesTouched = 0;
  const crypto = require('crypto');

  for (const item of cq){
    if(!item.active) continue;
    sourcesTouched++;

    let html="";
    let status="ok";
    try{
      html = await download(item.url);
    }catch(e){
      status="fetch_error";
    }

    if(status==="ok"){
      const parsed = extractFromHtml(html);

      const hash = crypto.createHash('md5')
        .update(parsed.txt)
        .digest('hex');

      if(hash !== item.last_seen_hash){
        const newLead = pushLead({
          buyer_type: item.buyer_typeGuess || "public",
          state: item.state || "?",
          urgency: parsed.urgency,
          tenant: item.tenantGuess || "federal-micro-purchase-fastlane",
          authorized_under_15k: parsed.authorized_under_15k,
          contact_email: parsed.emails[0] || "",
          contact_phone: parsed.phones[0] || "",
          title: parsed.category+" request ("+ (item.state||"?") +")",
          body: parsed.txt.slice(0,2000),
          source_url: item.url,
          sale_ready: true,
          source_channel: "crawler"
        });
        leadsCreated.push(newLead);
        item.last_seen_hash = hash;
      }
    }

    item.last_crawl_utc = new Date().toISOString();
    item.last_status = status;
  }

  writeJSON('crawler-queue.json', cq);

  return {
    statusCode:200,
    headers:corsHeaders(),
    body:JSON.stringify({
      ok:true,
      sources_touched:sourcesTouched,
      new_leads:leadsCreated.length,
      leads:leadsCreated
    })
  };
};
