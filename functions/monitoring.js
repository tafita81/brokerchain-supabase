// monitoring.js v27.0
// Health check and monitoring endpoint
// Provides real-time system statistics and health status

const { getLeads, getSuppliers, getSettings, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    const [leads, suppliers, settings] = await Promise.all([
      getLeads(),
      getSuppliers(),
      getSettings()
    ]);
    
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentLeads = leads.filter(l => 
      new Date(l.created_utc) > last24h
    );
    
    const stats = {
      timestamp: now.toISOString(),
      health: 'ok',
      system: {
        version: '27.0',
        environment: process.env.NODE_ENV || 'production'
      },
      leads: {
        total: leads.length,
        last_24h: recentLeads.length,
        by_status: {
          new: leads.filter(l => l.status === 'new').length,
          scraped: leads.filter(l => l.status === 'scraped').length,
          pending_supplier: leads.filter(l => l.status === 'pending-supplier').length,
          awaiting_authorization: leads.filter(l => l.status === 'awaiting-authorization').length
        },
        qualified: leads.filter(l => l.sale_ready).length,
        with_payment: leads.filter(l => l.stripe_payment_completed).length,
        with_signature: leads.filter(l => l.docusign_completed).length,
        with_alerts: leads.filter(l => l.alert_pending).length,
        by_tenant: {
          emergency: leads.filter(l => l.tenant === 'emergency-dispatch-exchange').length,
          federal: leads.filter(l => l.tenant === 'federal-micro-purchase-fastlane').length,
          solar: leads.filter(l => l.tenant === 'solar-home-us').length,
          b2b: leads.filter(l => l.tenant === 'global-sourcing-b2b').length
        }
      },
      suppliers: {
        total: suppliers.length,
        active: suppliers.filter(s => s.active).length,
        by_category: countByCategory(suppliers)
      },
      automation: {
        auto_dispatch: !!settings.AUTO_DISPATCH_ENABLED,
        scraper: !!settings.SCRAPER_ENABLED,
        brain: !!settings.BRAIN_ENABLED,
        crawler: !!settings.CRAWLER_ENABLED,
        intel_advisor: !!settings.INTEL_ADVISOR_ENABLED,
        billing: !!settings.BILLING_ENABLED,
        docusign: !!settings.DOCUSIGN_ENABLED,
        inbox: !!settings.INBOX_ENABLED,
        outreach: !!settings.OUTREACH_ENABLED
      },
      performance: {
        avg_leads_per_day: Math.round(recentLeads.length),
        conversion_rate: leads.length > 0 
          ? Math.round((leads.filter(l => l.sale_ready).length / leads.length) * 100) 
          : 0,
        dispatch_rate: leads.filter(l => l.sale_ready).length > 0
          ? Math.round((leads.filter(l => l.dispatch_assigned_utc).length / leads.filter(l => l.sale_ready).length) * 100)
          : 0
      }
    };
    
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(stats, null, 2)
    };
  } catch (error) {
    console.error('Monitoring error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ 
        health: 'error', 
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

function countByCategory(suppliers) {
  const counts = {};
  suppliers.forEach(s => {
    if (s.categories && Array.isArray(s.categories)) {
      s.categories.forEach(cat => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    }
  });
  return counts;
}
