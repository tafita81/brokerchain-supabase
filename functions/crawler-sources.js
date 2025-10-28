// crawler-sources.js v24.0
const { readJSON, writeJSON, corsHeaders } = require('./_util.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }

  if (event.httpMethod === 'GET') {
    const cq = readJSON('crawler-queue.json') || [];
    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true, sources:cq})
    };
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body||"{}"); } catch(e){}
    const cq = readJSON('crawler-queue.json') || [];
    if(!body.url){
      return {
        statusCode:400,
        headers:corsHeaders(),
        body:JSON.stringify({ok:false,error:"missing url"})
      };
    }

    cq.push({
      url: body.url,
      state: body.state || "?",
      tenantGuess: body.tenantGuess || "federal-micro-purchase-fastlane",
      categoryGuess: body.categoryGuess || "general-emergency",
      buyer_typeGuess: body.buyer_typeGuess || "public",
      active: !!body.active,
      last_seen_hash: "",
      last_crawl_utc: "",
      last_status: "added-manual"
    });

    writeJSON('crawler-queue.json',cq);

    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true,sources:cq})
    };
  }

  if (event.httpMethod === 'PATCH') {
    let body = {};
    try { body = JSON.parse(event.body||"{}"); } catch(e){}
    const cq = readJSON('crawler-queue.json') || [];
    if(!body.url){
      return {
        statusCode:400,
        headers:corsHeaders(),
        body:JSON.stringify({ok:false,error:"missing url"})
      };
    }

    let found = false;
    for (const item of cq){
      if(item.url === body.url){
        found = true;
        if(typeof body.active === 'boolean'){
          item.active = body.active;
        }
        if(body.tenantGuess){ item.tenantGuess = body.tenantGuess; }
        if(body.categoryGuess){ item.categoryGuess = body.categoryGuess; }
        if(body.buyer_typeGuess){ item.buyer_typeGuess = body.buyer_typeGuess; }
        item.last_status = "updated-manual";
      }
    }

    if(!found){
      return {
        statusCode:404,
        headers:corsHeaders(),
        body:JSON.stringify({ok:false,error:"url_not_found"})
      };
    }

    writeJSON('crawler-queue.json',cq);

    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true,sources:cq})
    };
  }

  return {
    statusCode:405,
    headers:corsHeaders(),
    body:"Method Not Allowed"
  };
};
