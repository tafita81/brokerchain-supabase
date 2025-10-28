const { readJSON, corsHeaders } = require('./_util.js');
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body||"{}");
    const emailCfg = readJSON('email.json') || {};

    const sysTone = `You are the 24/7 Dispatch / Procurement Desk for BrokerChain.
Rules:
- Answer in short, plain American business English.
- Sound human, calm, confident, urgent-capable.
- Ask only what is needed to move forward.
- Do NOT sign with a personal name.
- You are not "the founder", you are Dispatch or Procurement Desk.
- Emergency/Residential/Commercial: ask ZIP, urgency (1-2h / today / this week), insurance yes/no for roof/flood.
- Public/government/critical infra: ask if they are authorized to approve under $15k right now with a card.`;

    const userContent = `Context from inbox or outreach:\n${JSON.stringify(body || {})}\nNow draft the next email reply we should send.\nKeep it under ~6 short lines.`;

    const openaiKey = process.env.OPENAI_API_KEY || "MISSING_OPENAI_KEY";
    const apiUrl = emailCfg.openai_base_url || "https://api.openai.com/v1/chat/completions";
    const model = emailCfg.openai_model || "gpt-4o-mini";

    const payload = {
      model,
      messages: [
        {role:"system", content: sysTone},
        {role:"user", content: userContent}
      ],
      max_completion_tokens: 300
    };

    const resp = await fetch(apiUrl, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${openaiKey}`
      },
      body: JSON.stringify(payload)
    });

    if(!resp.ok){
      const text = await resp.text();
      return { statusCode:500, headers:corsHeaders(), body: JSON.stringify({ok:false, error:text}) };
    }

    const data = await resp.json();
    let reply = "";
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        reply = data.choices[0].message.content;
    } else if (data && data.choices && data.choices[0] && data.choices[0].text) {
        reply = data.choices[0].text;
    } else {
        reply = "(no draft)";
    }

    return {
      statusCode:200,
      headers:corsHeaders(),
      body: JSON.stringify({ok:true, draft:reply})
    };

  } catch (err) {
    return { statusCode:500, headers:corsHeaders(), body:JSON.stringify({ok:false, error:err.message}) };
  }
};
