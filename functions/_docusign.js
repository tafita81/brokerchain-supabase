// _docusign.js v18.1
// Cria envelope DocuSign rápido para autorização de emergência / micro-purchase

const fetch = require('node-fetch');

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
        return { ok:false, error:"DOCUSIGN_FAIL:"+txt };
    }
    const data = await resp.json();
    return { ok:true, envelopeId: data.envelopeId || data.envelopeID || "unknown-envelope" };

  } catch(e){
    console.error("DocuSign error", e);
    return { ok:false, error:e.message || "docusign_exception" };
  }
}

module.exports = {
  createDocusignEnvelope
};
