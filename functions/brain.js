// brain.js v27.0 - COM SUPABASE
const { getLeads, updateLeads, getSettings, corsHeaders } = require('./_supabase.js');

function buildMissingQuestions(lead) {
  const qs = [];
  if (!lead.zip || lead.zip === "00000") {
    qs.push("Please confirm ZIP code for dispatch / delivery.");
  }
  if (lead.buyer_type === "public" && (lead.authorized_under_15k === "unknown" || lead.authorized_under_15k === undefined)) {
    qs.push("Are you authorized to approve under the micro-purchase threshold (under ~15k USD) on card right now?");
  }
  return qs;
}

function shouldMarkSaleReady(lead) {
  if (lead.urgency === "1-2h" || lead.urgency === "today") return true;
  if (lead.tenant === "global-sourcing-b2b" && lead.urgency === "this-week") return true;
  return false;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const settings = await getSettings();
    if (!settings.BRAIN_ENABLED) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, skipped: true, reason: "BRAIN_DISABLED" })
      };
    }

    const leads = await getLeads();
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    const updatedLeads = leads.map(lead => {
      lead.ai_missing_questions = buildMissingQuestions(lead);

      if (!lead.sale_ready && shouldMarkSaleReady(lead)) {
        lead.sale_ready = true;
        if (lead.status === "scraped" || !lead.status || lead.status === "pending") {
          lead.status = "new";
        }
        lead.promoted_utc = nowIso;
        updatedCount++;
      }

      return lead;
    });

    await updateLeads(updatedLeads);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        leads_promoted: updatedCount,
        total_leads: leads.length
      })
    };
  } catch (error) {
    console.error('Brain error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
