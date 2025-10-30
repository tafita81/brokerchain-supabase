// _docusign.js v27.0 - COM RETRY LOGIC
// Cria envelope DocuSign rápido para autorização de emergência / micro-purchase
// Inclui retry automático e melhor tratamento de erros

const fetch = require('node-fetch');

// Função auxiliar para retry com exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Não retry em erros de autenticação ou permissão
      if (error.message && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
        throw error;
      }
      
      // Se é a última tentativa, throw o erro
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`DocuSign attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function createDocusignEnvelope(lead){
  try {
    const baseUrl = process.env.DOCUSIGN_BASE_URL || "";
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID || "";
    const accessToken = process.env.DOCUSIGN_ACCESS_TOKEN || "";
    const templateId = process.env.DOCUSIGN_TEMPLATE_ID || "";

    if (!baseUrl || !accountId || !accessToken){
      return { ok:false, error:"DOCUSIGN ENV VARS MISSING" };
    }

    let bodyPayload;
    if (templateId){
      bodyPayload = {
        templateId,
        status: "sent",
        templateRoles: [
          {
            roleName: "Buyer",
            name: lead.contact_email || "Buyer",
            email: lead.contact_email || "noemail@example.com",
            tabs: {
              textTabs: [
                { tabLabel:"LEAD_ID", value: lead.id || "" },
                { tabLabel:"NEED_DESC", value: lead.need || "" },
                { tabLabel:"STATE", value: lead.state || "" },
                { tabLabel:"AUTHORIZED_UNDER_15K", value: String(lead.authorized_under_15k) }
              ]
            }
          }
        ]
      };
    } else {
      const docContent = `
EMERGENCY AUTHORIZATION / MICRO-PURCHASE

Lead ID: ${lead.id || ""}
Need: ${lead.need || ""}
Location State: ${lead.state || ""}
Authorized under 15k USD: ${String(lead.authorized_under_15k)}

By signing you confirm you are authorized to approve this emergency purchase / dispatch.
      `;
      const docB64 = Buffer.from(docContent,"utf-8").toString("base64");

      bodyPayload = {
        status: "sent",
        emailSubject: "Emergency Authorization / Dispatch Confirmation",
        documents: [
          {
            documentBase64: docB64,
            documentId: "1",
            fileExtension: "txt",
            name: "emergency_authorization.txt"
          }
        ],
        recipients: {
          signers: [
            {
              name: lead.contact_email || "Buyer",
              email: lead.contact_email || "noemail@example.com",
              recipientId: "1",
              routingOrder: "1"
            }
          ]
        }
      };
    }

    const url = `${baseUrl}/v2.1/accounts/${accountId}/envelopes`;
    
    // Usar retry logic para criar o envelope
    const data = await retryWithBackoff(async () => {
      const resp = await fetch(url, {
        method:"POST",
        headers:{
          "Authorization": "Bearer "+accessToken,
          "Content-Type":"application/json"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!resp.ok){
        const txt = await resp.text();
        throw new Error("DOCUSIGN_FAIL:"+txt);
      }
      
      return await resp.json();
    });
    
    return { ok:true, envelopeId: data.envelopeId || data.envelopeID || "unknown-envelope" };

  } catch(e){
    console.error("DocuSign error after retries:", e);
    return { ok:false, error:e.message || "docusign_exception" };
  }
}

// Handler para webhooks do DocuSign
async function handleDocusignWebhook(event) {
  try {
    // DocuSign webhook events
    const envelopeId = event.envelopeId || event.data?.envelopeId;
    const status = event.status || event.data?.envelopeStatus;
    
    console.log(`DocuSign envelope ${envelopeId} status: ${status}`);
    
    switch (status) {
      case 'completed':
        console.log('Document signed successfully for envelope:', envelopeId);
        // Aqui você pode atualizar o lead no Supabase marcando como assinado
        return { ok: true, processed: true };
      
      case 'declined':
      case 'voided':
        console.log('Document declined/voided for envelope:', envelopeId);
        return { ok: true, processed: true };
      
      default:
        console.log('DocuSign event status:', status);
        return { ok: true, processed: false };
    }
  } catch (error) {
    console.error('Error processing DocuSign webhook:', error);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  createDocusignEnvelope,
  handleDocusignWebhook
};
