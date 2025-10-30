// Sistema de Follow-Up automatizado e agnóstico de storage
// - Regras por tenant
// - Calcula o próximo follow-up baseado em created_at/last_contact
// - Envia e-mail via _email_system

const { sendEmail } = require('./_email_system');

const FOLLOW_UP_RULES = {
  'emergency-dispatch-exchange': [
    { afterMinutes: 5,  subject: 'Emergency Team Ready', html: '<p>We are ready to assist you.</p>' },
    { afterMinutes: 15, subject: 'Limited Slots Remaining', html: '<p>Act fast to secure your spot.</p>' },
  ],
  'solar-home-us': [
    { afterMinutes: 30,  subject: 'Schedule Your Assessment', html: '<p>Book your solar consultation today.</p>' },
    { afterMinutes: 120, subject: 'Tax Credit Deadline', html: '<p>Don’t miss out on savings.</p>' },
  ],
};

function diffMinutes(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 60000);
}

function getNextFollowUpForLead(lead) {
  const rules = FOLLOW_UP_RULES[lead.tenant];
  if (!rules || !rules.length) return null;

  const now = new Date();
  const reference = new Date(lead.last_contact || lead.created_at || now.toISOString());
  const elapsed = diffMinutes(now, reference);

  return rules.find(r => r.afterMinutes > elapsed) || null;
}

async function sendFollowUp(lead, followUp) {
  await sendEmail(lead.email, followUp.subject, followUp.html);
  const when = new Date().toISOString();
  return {
    last_contact: when,
    last_follow_up_subject: followUp.subject,
  };
}

async function processFollowUps(getPendingLeads, updateLead) {
  const leads = await getPendingLeads();
  if (!Array.isArray(leads) || !leads.length) return { processed: 0, sent: 0 };

  let sent = 0;
  for (const lead of leads) {
    try {
      const next = getNextFollowUpForLead(lead);
      if (!next) continue;

      const patch = await sendFollowUp(lead, next);
      sent += 1;
      await updateLead(lead.id, { ...patch, status: 'followed_up' });
    } catch (err) {
      console.error('[follow_up_system] Erro ao processar lead:', lead?.id, err?.message);
    }
  }
  return { processed: leads.length, sent };
}

module.exports = {
  processFollowUps,
  getNextFollowUpForLead,
  FOLLOW_UP_RULES,
};