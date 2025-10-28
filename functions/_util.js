// _util.js v26.0 - CORRIGIDO PARA NETLIFY
// util compartilhado entre todas as Functions
// - leitura/gravação JSON local
// - dedupe de leads
// - registro de compradores
// - match de fornecedores
// - CORS

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function dataPath(fname){
  return path.join(__dirname, "..", "data", fname);
}

function readJSON(fname){
  try {
    const raw = fs.readFileSync(dataPath(fname), "utf8");
    return JSON.parse(raw);
  } catch(e){
    console.error(`Error reading ${fname}:`, e.message);
    return null;
  }
}

function writeJSON(fname, obj){
  try {
    const dirPath = path.dirname(dataPath(fname));
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(
      dataPath(fname),
      JSON.stringify(obj, null, 2),
      "utf8"
    );
  } catch(e){
    console.error(`Error writing ${fname}:`, e.message);
  }
}

function corsHeaders(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS,DELETE",
    "Access-Control-Allow-Headers":"Content-Type,Authorization"
  };
}

function randomId(prefix){
  return prefix + "-" +
    Math.random().toString(36).slice(2,8) + "-" +
    Date.now().toString(36);
}

// garante que buyers.json exista e é array
function ensureBuyers(){
  let buyers = readJSON("buyers.json");
  if(!Array.isArray(buyers)){
    buyers = [];
  }
  return buyers;
}

// registra/atualiza comprador baseado num lead
function upsertBuyerFromLead(lead){
  const buyers = ensureBuyers();

  const key = (lead.contact_email && lead.contact_email.toLowerCase())
    || (lead.contact_phone && lead.contact_phone.replace(/\D/g,""))
    || null;

  if(!key){
    return;
  }

  let found = buyers.find(b => b.dedupe_key === key);
  if(!found){
    found = {
      id: randomId("buyer"),
      dedupe_key: key,
      first_seen_utc: new Date().toISOString(),
      last_seen_utc: new Date().toISOString(),
      contact_email: lead.contact_email || "",
      contact_phone: lead.contact_phone || "",
      states: {},
      intents: {},
      authorized_under_15k: !!lead.authorized_under_15k,
      buyer_type: lead.buyer_type || "public"
    };
    buyers.push(found);
  } else {
    found.last_seen_utc = new Date().toISOString();
    if(lead.contact_email && !found.contact_email){
      found.contact_email = lead.contact_email;
    }
    if(lead.contact_phone && !found.contact_phone){
      found.contact_phone = lead.contact_phone;
    }
    const st = lead.state || "?";
    found.states[st] = true;

    const tenant = lead.tenant || "federal-micro-purchase-fastlane";
    found.intents[tenant] = true;

    if(lead.authorized_under_15k){
      found.authorized_under_15k = true;
    }
    if(lead.buyer_type && !found.buyer_type){
      found.buyer_type = lead.buyer_type;
    }
  }

  // garante mapas preenchidos
  const st2 = lead.state || "?";
  const tenant2 = lead.tenant || "federal-micro-purchase-fastlane";
  const idx = buyers.findIndex(b=>b.dedupe_key===key);
  if(idx>=0){
    if(!buyers[idx].states[st2]) buyers[idx].states[st2] = true;
    if(!buyers[idx].intents[tenant2]) buyers[idx].intents[tenant2] = true;
  }

  writeJSON("buyers.json", buyers);
}

// registra lead novo com dedupe e já atualiza buyers.json
function pushLead(lead){
  const leads = readJSON("leads.json") || [];

  const hashBasis = JSON.stringify({
    title: lead.title||"",
    contact_email: lead.contact_email||"",
    contact_phone: lead.contact_phone||"",
    body: lead.body||""
  });

  const hash = crypto.createHash('md5')
    .update(hashBasis)
    .digest('hex');

  const exists = leads.find(l => l.dedup_hash===hash);
  if (exists){
    return exists;
  }

  const newLead = {
    id: randomId("lead"),
    created_utc: new Date().toISOString(),
    dedup_hash: hash,
    buyer_type: lead.buyer_type || "public",
    state: lead.state || "?",
    urgency: lead.urgency || "unknown",
    tenant: lead.tenant || "federal-micro-purchase-fastlane",
    authorized_under_15k: !!lead.authorized_under_15k,
    contact_email: lead.contact_email || "",
    contact_phone: lead.contact_phone || "",
    title: lead.title || "",
    body: lead.body || "",
    source_url: lead.source_url || "",
    source_channel: lead.source_channel || "crawler",
    status: "scraped",
    sale_ready: !!lead.sale_ready,
    category: lead.category || "general",
    zip: lead.zip || "00000"
  };

  leads.push(newLead);
  writeJSON("leads.json", leads);

  // Atualiza base de compradores
  upsertBuyerFromLead(newLead);

  return newLead;
}

// NOVA FUNÇÃO: salvar leads (usada pelo dispatch)
function saveLeads(leads){
  writeJSON("leads.json", leads);
}

// NOVA FUNÇÃO: match de fornecedor para lead
function matchSupplierForLead(lead, suppliers){
  if(!Array.isArray(suppliers) || suppliers.length === 0){
    return null;
  }

  // Filtra por estado
  const stateMatches = suppliers.filter(s => 
    s.state === lead.state || s.states_served?.includes(lead.state)
  );

  if(stateMatches.length === 0){
    return null;
  }

  // Filtra por categoria se disponível
  const category = lead.category || "general";
  const categoryMatches = stateMatches.filter(s => 
    !s.categories || s.categories.length === 0 || s.categories.includes(category)
  );

  if(categoryMatches.length > 0){
    // Retorna fornecedor aleatório dos matches
    return categoryMatches[Math.floor(Math.random() * categoryMatches.length)];
  }

  // Fallback: retorna qualquer fornecedor do estado
  return stateMatches[Math.floor(Math.random() * stateMatches.length)];
}

module.exports = {
  readJSON,
  writeJSON,
  corsHeaders,
  pushLead,
  upsertBuyerFromLead,
  saveLeads,
  matchSupplierForLead,
  randomId
};
