// functions/_email_system.js

const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');

// SMTP configuration (env-first, with sensible defaults)
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.brokerchain.business';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : SMTP_PORT === 465;
const EMAIL_USER = process.env.EMAIL_USER || 'contact@brokerchain.business';
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS; // prefer env; do NOT hardcode secrets

if (!EMAIL_PASS) {
  console.warn('[email_system] WARNING: EMAIL_PASS/SMTP_PASS is not set. Set it in your environment for sending to work.');
}

const smtpTransport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: EMAIL_PASS ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
});

// IMAP configuration (env-first, with sensible defaults)
const IMAP_HOST = process.env.IMAP_HOST || 'imap.brokerchain.business';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
const IMAP_SECURE = process.env.IMAP_SECURE ? process.env.IMAP_SECURE === 'true' : true;
const IMAP_USER = process.env.IMAP_USER || EMAIL_USER;
const IMAP_PASS = process.env.IMAP_PASS || EMAIL_PASS;

if (!IMAP_PASS) {
  console.warn('[email_system] WARNING: IMAP_PASS/EMAIL_PASS is not set. Set it in your environment for inbox polling to work.');
}

// Basic AI-like classification (heuristic placeholder)
function classifyEmail({ subject = '', body = '' } = {}) {
  const text = `${subject} ${body}`.toLowerCase();
  if (/buy\b|\bquote\b|\bprice\b|cotação|preço|orçamento/.test(text)) return 'buyer';
  if (/supplier|supply|wholesale|fornecedor|distribuidor/.test(text)) return 'supplier';
  if (/support|help|issue|erro|bug/.test(text)) return 'support';
  return 'general';
}

// Very simple context tracking helper using headers
function trackContext({ messageId, inReplyTo, references, subject }) {
  // Prefer explicit threading headers
  const ref = inReplyTo || (Array.isArray(references) && references[0]) || messageId || subject;
  return String(ref || '').trim();
}

async function sendEmail(to, subject, html) {
  if (!EMAIL_PASS) throw new Error('EMAIL_PASS/SMTP_PASS not set in environment.');

  const mailOptions = {
    from: EMAIL_USER,
    to,
    subject,
    html,
  };

  await smtpTransport.sendMail(mailOptions);
  console.log(`[email_system] Email sent to ${to} :: ${subject}`);
}

// Start a lightweight inbox watcher that logs and classifies new mail
async function startInboxWatcher({ onEmail } = {}) {
  if (!IMAP_PASS) throw new Error('IMAP_PASS/EMAIL_PASS not set in environment.');

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
  });

  await client.connect();
  await client.mailboxOpen('INBOX');
  console.log('[email_system] INBOX opened, watching for new emails...');

  // On new mail exists event
  client.on('exists', async () => {
    try {
      // Fetch the latest message only
      const lock = await client.getMailboxLock('INBOX');
      try {
        const seq = `${client.mailbox.exists}:*`;
        for await (const msg of client.fetch(seq, { envelope: true, source: true, uid: true, flags: true })) {
          const envelope = msg.envelope || {};
          const from = (envelope.from && envelope.from[0] && (envelope.from[0].address || envelope.from[0].name)) || 'unknown';
          const subject = envelope.subject || '';
          const body = msg.source ? msg.source.toString() : '';

          const classification = classifyEmail({ subject, body });
          const contextKey = trackContext({
            messageId: envelope['message-id'],
            inReplyTo: envelope['in-reply-to'],
            references: envelope.references,
            subject,
          });

          console.log(`[email_system] New email from: ${from} | subject: ${subject} | class: ${classification} | ctx: ${contextKey}`);

          if (typeof onEmail === 'function') {
            await onEmail({ from, subject, body, classification, contextKey, envelope });
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.error('[email_system] Error handling new email:', err);
    }
  });

  // Return a disposer to close the connection when needed
  return async () => {
    try {
      await client.logout();
      console.log('[email_system] INBOX watcher stopped.');
    } catch (_) {}
  };
}

// Simple local test helper. Note: running this inside serverless may timeout.
async function testEmail(recipient = process.env.TEST_RECIPIENT || 'Tafita1981novo@gmail.com') {
  await sendEmail(recipient, 'Test Email from Brokerchain', '<p>This is a test email sent from the Brokerchain system.</p>');
}

module.exports = {
  sendEmail,
  startInboxWatcher,
  classifyEmail,
  trackContext,
  testEmail,
};