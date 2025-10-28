// intel-advisor-run.js v24.0
const { readJSON, writeJSON, corsHeaders } = require('./_util.js');

function recentLeads(leads){
  const out=[];
  const now=Date.now();
  for(const L of leads){
    const t = Date.parse(L.created_utc||"");
    if(!t) continue;
    const diffH = (now - t)/(1000*60*60);
    if(diffH <= 48){
      out.push(L);
    }
  }
  return out;
}

function computeHotspots(leads48){
  const countsByState={};
  const countsByCat={};
  for(const L of leads48){
    const st=L.state||"?";
    countsByState[st]=(countsByState[st]||0)+1;
    const cat=L.title||"unknown";
    countsByCat[cat]=(countsByCat[cat]||0)+1;
  }
  const hotStates = Object.entries(countsByState)
    .map(([state,count])=>({state,count}))
    .sort((a,b)=>b.count-a.count)
    .slice(0,5);
  const topCategories = Object.entries(countsByCat)
    .map(([category,count])=>({category,count}))
    .sort((a,b)=>b.count-a.count)
    .slice(0,5);
  return {hotStates, topCategories};
}

function buildPrompt(hotStates, topCategories){
  const statesList = hotStates
    .map(s=>s.state)
    .filter(s=>s && s!=="?")
    .join(", ");
  const catsList = topCategories.map(c=>c.category).join(", ");
  const prompt = `
You are BrokerChain Intel. Task: suggest PUBLIC web pages (city / county / emergency management / procurement / utility outage / informal emergency bid boards) in US states [${statesList}] that publish urgent needs for categories [${catsList}] such as backup generators, flood pumps, HVAC outage, roof tarping, solar backup installs, spill kits, PPE, micro-purchase under 15k USD.

Rules:
- Only include sources that are PUBLIC and do NOT require login.
- Prefer pages where phone/email contact or "purchase card" / "micro-purchase" language appears.
- Return ONLY a JSON array. Each element:
  {
    "url": "...",
    "state": "TX",
    "tenantGuess": "federal-micro-purchase-fastlane" | "emergency-dispatch-exchange" | "global-sourcing-b2b" | "solar-home-us",
    "categoryGuess": "generator" | "flood-pump" | "roof-repair" | "hvac" | "solar-backup" | "ppe-industrial",
    "buyer_typeGuess": "public" | "private_industrial"
  }

Max 5 elements.
  `;
  return prompt;
}

async function callOpenAI(prompt){
  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey){
    return {ok:false, suggestions:[], error:"missing_openai_key"};
  }

  const body = {
    model: "gpt-4o-mini",
    messages: [
      {"role":"system","content":"You are a sourcing intelligence agent."},
      {"role":"user","content":prompt}
    ],
    temperature: 0.2
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+apiKey,
      "Content-Type":"application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  let raw = "";
  try{
    raw = data.choices[0].message.content.trim();
  }catch(e){}
  const idx = raw.indexOf('[');
  let arrText = "[]";
  if(idx>=0){
    arrText = raw.slice(idx);
  }
  let outArr=[];
  try{
    outArr = JSON.parse(arrText);
  }catch(e){
    outArr = [];
  }
  if(!Array.isArray(outArr)){
    outArr = [];
  }
  return {ok:true, suggestions:outArr, error:null};
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {statusCode:200, headers:corsHeaders(), body:''};
  }
  if (event.httpMethod!=='GET' && event.httpMethod!=='POST'){
    return {statusCode:405, headers:corsHeaders(), body:'Method Not Allowed'};
  }

  const settings = readJSON('settings.json') || {};
  const leadsAll = readJSON('leads.json') || [];
  const cq        = readJSON('crawler-queue.json') || [];
  const prevIntel = readJSON('intel-report.json') || {};

  const leads48 = recentLeads(leadsAll);
  const {hotStates, topCategories} = computeHotspots(leads48);

  let addedCount=0;
  let suggestionsFinal=[];
  let openai_error=false;

  if(settings.INTEL_ADVISOR_ENABLED){
    const prompt = buildPrompt(hotStates, topCategories);
    const aiRes = await callOpenAI(prompt);
    if(!aiRes.ok){
      openai_error=true;
    } else {
      suggestionsFinal = aiRes.suggestions;
      for (const sug of suggestionsFinal){
        if(!sug.url) continue;
        const already = cq.find(e=>e.url===sug.url);
        if(already) continue;
        cq.push({
          url: sug.url,
          state: sug.state || "?",
          tenantGuess: sug.tenantGuess || "federal-micro-purchase-fastlane",
          categoryGuess: sug.categoryGuess || "general-emergency",
          buyer_typeGuess: sug.buyer_typeGuess || "public",
          active: false,
          last_seen_hash:"",
          last_crawl_utc:"",
          last_status:"seeded-by-intel"
        });
        addedCount++;
      }
      writeJSON('crawler-queue.json', cq);
    }
  }

  const report = {
    generated_utc: new Date().toISOString(),
    hotStates,
    topCategories,
    suggestions: suggestionsFinal,
    addedCount,
    openai_error
  };
  writeJSON('intel-report.json', report);

  return {
    statusCode:200,
    headers:corsHeaders(),
    body:JSON.stringify({
      ok:true,
      report
    })
  };
};
