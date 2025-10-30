// crawler-sources.js v27.0 - COM SUPABASE
const { getCrawlerQueue, createCrawlerQueueItem, updateCrawlerQueueItem, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const sources = await getCrawlerQueue();
      return {
        statusCode:200,
        headers:corsHeaders(),
        body:JSON.stringify({ok:true, sources})
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body||"{}");
      
      if(!body.url){
        return {
          statusCode:400,
          headers:corsHeaders(),
          body:JSON.stringify({ok:false,error:"missing url"})
        };
      }

      const newItem = {
        url: body.url,
        state: body.state || "?",
        tenant_guess: body.tenantGuess || "federal-micro-purchase-fastlane",
        category_guess: body.categoryGuess || "general-emergency",
        buyer_type_guess: body.buyer_typeGuess || "public",
        active: !!body.active,
        status: "pending",
        last_status: "added-manual"
      };

      const created = await createCrawlerQueueItem(newItem);

      if (created) {
        return {
          statusCode:200,
          headers:corsHeaders(),
          body:JSON.stringify({ok:true, source:created})
        };
      } else {
        return {
          statusCode:400,
          headers:corsHeaders(),
          body:JSON.stringify({ok:false, error:"Failed to create crawler source"})
        };
      }
    }

    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body||"{}");
      
      if(!body.id && !body.url){
        return {
          statusCode:400,
          headers:corsHeaders(),
          body:JSON.stringify({ok:false,error:"missing id or url"})
        };
      }

      // Find by URL if ID not provided
      let itemId = body.id;
      if (!itemId && body.url) {
        const sources = await getCrawlerQueue();
        const found = sources.find(s => s.url === body.url);
        if (found) {
          itemId = found.id;
        }
      }

      if (!itemId) {
        return {
          statusCode:404,
          headers:corsHeaders(),
          body:JSON.stringify({ok:false,error:"source not found"})
        };
      }

      const updates = {};
      if(typeof body.active === 'boolean') updates.active = body.active;
      if(body.tenantGuess) updates.tenant_guess = body.tenantGuess;
      if(body.categoryGuess) updates.category_guess = body.categoryGuess;
      if(body.buyer_typeGuess) updates.buyer_type_guess = body.buyer_typeGuess;
      updates.last_status = "updated-manual";

      const updated = await updateCrawlerQueueItem(itemId, updates);

      if (updated) {
        return {
          statusCode:200,
          headers:corsHeaders(),
          body:JSON.stringify({ok:true, source:updated})
        };
      } else {
        return {
          statusCode:404,
          headers:corsHeaders(),
          body:JSON.stringify({ok:false,error:"Failed to update source"})
        };
      }
    }

    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  } catch (error) {
    console.error('Crawler sources error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
    };
  }

  return {
    statusCode:405,
    headers:corsHeaders(),
    body:"Method Not Allowed"
  };
};
