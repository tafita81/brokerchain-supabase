// scrape-leads.js v27.0 - COM SUPABASE
const { createLead, getSettings, corsHeaders, randomId } = require('./_supabase.js');

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

function buildLeadsForState(state) {
  const examples = [];

  examples.push({
    buyer_type: "public",
    source_channel: "city-utility-alert",
    body: `City utility in ${state} needs 3 portable flood pumps to clear water from substation. Under $15k total. Authorized to card immediately.`,
    title: `Emergency flood pumps needed - ${state}`,
    urgency: "today",
    category: "water-mitigation",
    zip: "00000",
    tenant: "federal-micro-purchase-fastlane",
    authorized_under_15k: true
  });

  examples.push({
    buyer_type: "public",
    source_channel: "county-emergency-management",
    body: `County emergency office in ${state} requesting diesel generator trailer for backup power at shelter. Must deliver within 24h.`,
    title: `Diesel generator needed - ${state}`,
    urgency: "today",
    category: "power-generation",
    zip: "00000",
    tenant: "federal-micro-purchase-fastlane",
    authorized_under_15k: true
  });

  examples.push({
    buyer_type: "private",
    source_channel: "storm-report-hail",
    body: `Severe hail tore roof membrane at commercial site in ${state}. Water dripping into server racks now. Need emergency tarp + mitigation.`,
    title: `Emergency roof repair - ${state}`,
    urgency: "1-2h",
    category: "roofing-emergency",
    zip: "00000",
    tenant: "emergency-dispatch-exchange"
  });

  examples.push({
    buyer_type: "private",
    source_channel: "afterhours-maintenance-call",
    body: `HVAC shutdown in data/medical facility in ${state}. We need 24/7 technician on site ASAP to restore cooling.`,
    title: `HVAC emergency - ${state}`,
    urgency: "1-2h",
    category: "hvac-failure",
    zip: "00000",
    tenant: "emergency-dispatch-exchange"
  });

  examples.push({
    buyer_type: "private",
    source_channel: "solar-inquiry-deadline",
    body: `Homeowner / small commercial in ${state} wants rooftop solar + backup battery. They were told tax credit is expiring and want quote + install commitment THIS WEEK.`,
    title: `Solar installation urgent - ${state}`,
    urgency: "today",
    category: "solar-install",
    zip: "00000",
    tenant: "solar-home-us"
  });

  examples.push({
    buyer_type: "private-enterprise",
    source_channel: "plant-maintenance-request",
    body: `Industrial facility in ${state} needs 200 chemical-resistant gloves, spill containment kits, and 2 replacement pump seals. Wants delivery this week, can pay via PO or card.`,
    title: `Industrial supplies needed - ${state}`,
    urgency: "this-week",
    category: "industrial-supply",
    zip: "00000",
    tenant: "global-sourcing-b2b"
  });

  return examples;
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
    if (!settings.SCRAPER_ENABLED) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, skipped: true, reason: "SCRAPER_DISABLED" })
      };
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const state of US_STATES) {
      const examples = buildLeadsForState(state);
      
      for (const ex of examples) {
        const lead = {
          state,
          ...ex,
          contact_email: `buyer-${randomId('contact')}@example.com`,
          contact_phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`,
          source_url: `https://example.com/lead/${randomId('src')}`,
          status: "scraped",
          sale_ready: false
        };

        const created = await createLead(lead);
        if (created) {
          totalCreated++;
        } else {
          totalSkipped++;
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        states_processed: US_STATES.length,
        leads_created: totalCreated,
        leads_skipped: totalSkipped
      })
    };
  } catch (error) {
    console.error('Scrape leads error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
