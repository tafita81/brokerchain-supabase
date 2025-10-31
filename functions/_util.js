// _util.js v27.0 - MIGRADO PARA SUPABASE
// Util compartilhado entre todas as Functions
// Agora usa Supabase em vez de arquivos JSON locais

const crypto = require('crypto');
const {
  getLeads,
  createLead,
  updateLeads,
  getSuppliers,
  matchSupplierForLead: supabaseMatchSupplier,
  randomId: supabaseRandomId,
  corsHeaders: supabaseCorsHeaders,
  upsertBuyerFromLead: supabaseUpsertBuyer,
} = require('./_supabase');
const { logInfo, logWarn, logError } = require('./_logger');

/**
 * CORS headers (delegado para _supabase.js)
 */
function corsHeaders() {
  return supabaseCorsHeaders();
}

/**
 * Gera ID aleatório (delegado para _supabase.js)
 */
function randomId(prefix) {
  return supabaseRandomId(prefix);
}

/**
 * Registra/atualiza comprador baseado num lead
 * Agora usa Supabase em vez de JSON
 */
async function upsertBuyerFromLead(lead) {
  try {
    await supabaseUpsertBuyer(lead);
    logInfo('Buyer upserted', {
      leadId: lead.id,
      contact: lead.contact_email || lead.contact_phone,
    });
  } catch (error) {
    logError('Error upserting buyer', error, { leadId: lead.id });
  }
}

/**
 * Registra lead novo com dedupe
 * Agora usa Supabase em vez de JSON
 */
async function pushLead(lead) {
  try {
    // Gerar dedup_hash
    const hashBasis = JSON.stringify({
      title: lead.title || '',
      contact_email: lead.contact_email || '',
      contact_phone: lead.contact_phone || '',
      body: lead.body || '',
    });

    const hash = crypto.createHash('md5').update(hashBasis).digest('hex');

    // Verificar se já existe
    const existingLeads = await getLeads();
    const exists = existingLeads.find((l) => l.dedup_hash === hash);

    if (exists) {
      logInfo('Lead already exists (duplicate)', {
        leadId: exists.id,
        dedup_hash: hash,
      });
      return exists;
    }

    // Criar novo lead
    const newLead = {
      id: randomId('lead'),
      created_utc: new Date().toISOString(),
      dedup_hash: hash,
      buyer_type: lead.buyer_type || 'public',
      state: lead.state || '?',
      urgency: lead.urgency || 'unknown',
      tenant: lead.tenant || 'federal-micro-purchase-fastlane',
      authorized_under_15k: !!lead.authorized_under_15k,
      contact_email: lead.contact_email || '',
      contact_phone: lead.contact_phone || '',
      title: lead.title || '',
      body: lead.body || '',
      source_url: lead.source_url || '',
      source_channel: lead.source_channel || 'crawler',
      status: 'scraped',
      sale_ready: !!lead.sale_ready,
      category: lead.category || 'general',
      zip: lead.zip || '00000',
    };

    const created = await createLead(newLead);

    if (!created) {
      logError('Failed to create lead in Supabase');
      return null;
    }

    logInfo('New lead created', {
      leadId: created.id,
      category: created.category,
      state: created.state,
    });

    return created;
  } catch (error) {
    logError('Error pushing lead', error);
    return null;
  }
}

/**
 * Salvar leads (batch update)
 * Agora usa Supabase em vez de JSON
 */
async function saveLeads(leads) {
  try {
    if (!Array.isArray(leads) || leads.length === 0) {
      logWarn('saveLeads called with empty or invalid leads array');
      return;
    }

    const updated = await updateLeads(leads);

    logInfo('Leads saved to Supabase', {
      count: updated.length,
    });

    return updated;
  } catch (error) {
    logError('Error saving leads', error);
    return [];
  }
}

/**
 * Match de fornecedor para lead
 * Agora usa Supabase em vez de JSON
 */
async function matchSupplierForLead(lead) {
  try {
    const supplier = await supabaseMatchSupplier(lead);

    if (supplier) {
      logInfo('Supplier matched', {
        leadId: lead.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
      });
    } else {
      logWarn('No supplier match found', {
        leadId: lead.id,
        state: lead.state,
        category: lead.category,
      });
    }

    return supplier;
  } catch (error) {
    logError('Error matching supplier', error, { leadId: lead.id });
    return null;
  }
}

/**
 * DEPRECATED: readJSON
 * Mantido para compatibilidade, mas agora retorna null e loga warning
 */
function readJSON(fname) {
  logWarn('readJSON is deprecated - data is now in Supabase', {
    file: fname,
    migration: 'Please use Supabase functions instead',
  });
  return null;
}

/**
 * DEPRECATED: writeJSON
 * Mantido para compatibilidade, mas agora não faz nada e loga warning
 */
function writeJSON(fname, obj) {
  logWarn('writeJSON is deprecated - data is now in Supabase', {
    file: fname,
    migration: 'Please use Supabase functions instead',
  });
}

/**
 * DEPRECATED: ensureBuyers
 * Mantido para compatibilidade, mas agora retorna array vazio
 */
function ensureBuyers() {
  logWarn('ensureBuyers is deprecated - use getBuyers from _supabase.js instead');
  return [];
}

module.exports = {
  // Funções principais (migradas para Supabase)
  corsHeaders,
  pushLead,
  upsertBuyerFromLead,
  saveLeads,
  matchSupplierForLead,
  randomId,

  // Funções deprecated (mantidas para compatibilidade)
  readJSON,
  writeJSON,
  ensureBuyers,
};

