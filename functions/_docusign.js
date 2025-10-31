// _docusign.js v18.1
// Cria envelope DocuSign rápido para autorização de emergência / micro-purchase
// Agora com retry logic e backoff exponencial

const axios = require('axios');
const { logInfo, logError, logExternalApiCall, logPerformance } = require('./_logger');

/**
 * Retry com backoff exponencial
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;

      // Não fazer retry em erros 4xx (exceto 429)
      const status = error.response?.status || error.statusCode;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      if (isLastAttempt) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, i);
      logInfo(`DocuSign retry attempt ${i + 1}/${maxRetries} after ${delay}ms`, {
        error: error.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function createDocusignEnvelope(lead) {
  const startTime = Date.now();

  try {
    const baseUrl = process.env.DOCUSIGN_BASE_URL || '';
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID || '';
    const accessToken = process.env.DOCUSIGN_ACCESS_TOKEN || '';
    const templateId = process.env.DOCUSIGN_TEMPLATE_ID || '';

    if (!baseUrl || !accountId || !accessToken) {
      logError('DocuSign ENV VARS MISSING');
      return { ok: false, error: 'DOCUSIGN ENV VARS MISSING' };
    }

    logExternalApiCall('DocuSign', '/envelopes', {
      leadId: lead.id,
      useTemplate: !!templateId,
    });

    let bodyPayload;
    if (templateId) {
      bodyPayload = {
        templateId,
        status: 'sent',
        templateRoles: [
          {
            roleName: 'Buyer',
            name: lead.contact_email || 'Buyer',
            email: lead.contact_email || 'noemail@example.com',
            tabs: {
              textTabs: [
                { tabLabel: 'LEAD_ID', value: lead.id || '' },
                { tabLabel: 'NEED_DESC', value: lead.need || '' },
                { tabLabel: 'STATE', value: lead.state || '' },
                {
                  tabLabel: 'AUTHORIZED_UNDER_15K',
                  value: String(lead.authorized_under_15k),
                },
              ],
            },
          },
        ],
      };
    } else {
      const docContent = `
EMERGENCY AUTHORIZATION / MICRO-PURCHASE

Lead ID: ${lead.id || ''}
Need: ${lead.need || ''}
Location State: ${lead.state || ''}
Authorized under 15k USD: ${String(lead.authorized_under_15k)}

By signing you confirm you are authorized to approve this emergency purchase / dispatch.
      `;
      const docB64 = Buffer.from(docContent, 'utf-8').toString('base64');

      bodyPayload = {
        status: 'sent',
        emailSubject: 'Emergency Authorization / Dispatch Confirmation',
        documents: [
          {
            documentBase64: docB64,
            documentId: '1',
            fileExtension: 'txt',
            name: 'emergency_authorization.txt',
          },
        ],
        recipients: {
          signers: [
            {
              name: lead.contact_email || 'Buyer',
              email: lead.contact_email || 'noemail@example.com',
              recipientId: '1',
              routingOrder: '1',
            },
          ],
        },
      };
    }

    const url = `${baseUrl}/v2.1/accounts/${accountId}/envelopes`;

    const response = await retryWithBackoff(async () => {
      return await axios.post(url, bodyPayload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    });

    const duration = Date.now() - startTime;
    logPerformance('createDocusignEnvelope', duration, {
      leadId: lead.id,
      envelopeId: response.data.envelopeId,
    });

    return {
      ok: true,
      envelopeId: response.data.envelopeId || response.data.envelopeID || 'unknown-envelope',
    };
  } catch (e) {
    logError('DocuSign error', e, {
      leadId: lead.id,
      message: e.response?.data || e.message,
    });

    return {
      ok: false,
      error: e.response?.data || e.message || 'docusign_exception',
    };
  }
}

module.exports = {
  createDocusignEnvelope,
  retryWithBackoff,
};

