// scrape-suppliers.js v27.0 - COM SUPABASE
// Gera fornecedores standby (TODOS os estados + DC) inclusive:
// - Flood / Pump / Water Mitigation
// - Roofing / Hail Emergency
// - Critical HVAC
// - Generator / Power Backup
// - Solar Install & Battery Backup Fast Close
// - Industrial / MRO / PPE Bulk (global-sourcing-b2b)
//
// Cada fornecedor é um candidato que pode aceitar job pago.
// billing_pref = "stripe_per_job_dispatch" significa que ele paga por lead/job recebido.

const { createSupplier, getSettings, corsHeaders, randomId } = require('./_supabase.js');

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

function vendorsForState(st) {
  const baseZipMask = st + "***";
  return [
    {
      business_name: `${st} Flood & Pump Response 24/7`,
      categories: ["water-mitigation","pump-out","generator-rental"],
      geo: st+" statewide flood / storm",
      billing_pref: "stripe_per_job_dispatch"
    },
    {
      business_name: `${st} Emergency Roof Tarp & Hail Repair`,
      categories: ["roofing-emergency","hail-damage"],
      geo: st+" statewide storm belt",
      billing_pref: "stripe_per_job_dispatch"
    },
    {
      business_name: `${st} Critical HVAC Rapid Service`,
      categories: ["hvac-failure","cooling-emergency"],
      geo: st+" commercial / medical facilities",
      billing_pref: "stripe_per_job_dispatch"
    },
    {
      business_name: `${st} Industrial Generator & Power Backup`,
      categories: ["power-generation","generator-rental"],
      geo: st+" utility / shelter backup power",
      billing_pref: "stripe_per_job_dispatch"
    },
    {
      business_name: `${st} Solar Install & Battery Backup Fast Close`,
      categories: ["solar-install"],
      geo: st+" residential / light commercial solar + storage",
      billing_pref: "stripe_per_job_dispatch"
    },
    {
      business_name: `${st} Industrial MRO & Safety Supply Desk`,
      categories: ["industrial-supply","ppe-bulk","mro-parts"],
      geo: st+" manufacturing / plants / utilities / refineries",
      billing_pref: "stripe_per_job_dispatch"
    }
  ].map(base => ({
    name: base.business_name,
    business_name: base.business_name,
    email: ("dispatch@" + base.business_name.replace(/\s+/g,'').toLowerCase() + ".example.com"),
    phone: "+1-000-000-0000",
    phone24h: "+1-000-000-0000",
    categories: base.categories,
    state: st,
    states_served: [st],
    billing_pref: base.billing_pref,
    active: true
  }));
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  }

  try {
    const settings = await getSettings();
    if (!settings.SCRAPER_ENABLED) {
      return {
        statusCode:200,
        headers:corsHeaders(),
        body:JSON.stringify({ok:true, skipped:true, reason:"SCRAPER_DISABLED"})
      };
    }

    let totalCreated = 0;
    for (const st of US_STATES) {
      const arr = vendorsForState(st);
      for (const v of arr) {
        const created = await createSupplier(v);
        if (created) totalCreated++;
      }
    }

    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true, nationwide_suppliers: totalCreated})
    };
  } catch (error) {
    console.error('Scrape suppliers error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
