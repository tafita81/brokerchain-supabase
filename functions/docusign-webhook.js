// docusign-webhook.js v27.0
// Handler para webhooks do DocuSign
// Processa eventos de assinatura e atualiza leads no Supabase

const { handleDocusignWebhook } = require('./_docusign.js');
const { getLeads, updateLead, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Processar o webhook do DocuSign
    const result = await handleDocusignWebhook(body);
    
    // Se o evento foi processado com sucesso, atualizar o lead no Supabase
    if (result.ok && result.processed) {
      const envelopeId = body.envelopeId || body.data?.envelopeId;
      
      if (envelopeId) {
        // Buscar o lead pelo envelope_id
        const leads = await getLeads();
        const lead = leads.find(l => l.docusign_envelope_id === envelopeId);
        
        if (lead) {
          const status = body.status || body.data?.envelopeStatus;
          
          if (status === 'completed') {
            await updateLead(lead.id, {
              docusign_completed: true,
              docusign_completed_utc: new Date().toISOString(),
              status: 'document-signed'
            });
          } else if (status === 'declined' || status === 'voided') {
            await updateLead(lead.id, {
              docusign_declined: true,
              docusign_declined_utc: new Date().toISOString(),
              alert_pending: true,
              alert_reason: 'docusign_declined_or_voided'
            });
          }
        }
      }
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('DocuSign webhook error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
