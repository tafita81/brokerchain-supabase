// _supabase.js v27.0
// Camada de abstração para Supabase
// Substitui o sistema de arquivos JSON por banco de dados real

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Inicializar cliente Supabase
let supabase = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('SUPABASE_URL or SUPABASE_KEY not configured');
    throw new Error('Supabase not configured');
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

// ============================================================================
// LEADS
// ============================================================================

async function getLeads(filters = {}) {
  try {
    const client = getSupabaseClient();
    let query = client.from('leads').select('*');
    
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.sale_ready !== undefined) {
      query = query.eq('sale_ready', filters.sale_ready);
    }
    if (filters.tenant) {
      query = query.eq('tenant', filters.tenant);
    }
    
    query = query.order('created_utc', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting leads:', error.message);
    return [];
  }
}

async function getLeadById(id) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting lead:', error.message);
    return null;
  }
}

async function createLead(lead) {
  try {
    const client = getSupabaseClient();
    
    // Gerar ID se não existir
    if (!lead.id) {
      lead.id = randomId('lead');
    }
    
    // Gerar dedup_hash
    if (!lead.dedup_hash) {
      const hashBasis = JSON.stringify({
        title: lead.title || "",
        contact_email: lead.contact_email || "",
        contact_phone: lead.contact_phone || "",
        body: lead.body || ""
      });
      lead.dedup_hash = crypto.createHash('md5').update(hashBasis).digest('hex');
    }
    
    // Verificar se já existe (dedupe)
    const existing = await client
      .from('leads')
      .select('id')
      .eq('dedup_hash', lead.dedup_hash)
      .single();
    
    if (existing.data) {
      console.log('Lead already exists:', existing.data.id);
      return existing.data;
    }
    
    // Inserir novo lead
    const { data, error } = await client
      .from('leads')
      .insert(lead)
      .select()
      .single();
    
    if (error) throw error;
    
    // Atualizar buyers
    if (data) {
      await upsertBuyerFromLead(data);
    }
    
    return data;
  } catch (error) {
    console.error('Error creating lead:', error.message);
    return null;
  }
}

async function updateLead(id, updates) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating lead:', error.message);
    return null;
  }
}

async function updateLeads(leads) {
  try {
    const client = getSupabaseClient();
    
    // Atualizar em lote
    const updates = leads.map(lead => ({
      id: lead.id,
      ...lead
    }));
    
    const { data, error } = await client
      .from('leads')
      .upsert(updates, { onConflict: 'id' })
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating leads:', error.message);
    return [];
  }
}

// ============================================================================
// SUPPLIERS
// ============================================================================

async function getSuppliers(filters = {}) {
  try {
    const client = getSupabaseClient();
    let query = client.from('suppliers').select('*');
    
    if (filters.state) {
      query = query.eq('state', filters.state);
    }
    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting suppliers:', error.message);
    return [];
  }
}

async function createSupplier(supplier) {
  try {
    const client = getSupabaseClient();
    
    if (!supplier.id) {
      supplier.id = randomId('supplier');
    }
    
    const { data, error } = await client
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating supplier:', error.message);
    return null;
  }
}

async function matchSupplierForLead(lead) {
  try {
    const suppliers = await getSuppliers({ active: true });
    
    if (!suppliers || suppliers.length === 0) {
      return null;
    }
    
    // Filtra por estado
    const stateMatches = suppliers.filter(s => 
      s.state === lead.state || (s.states_served && s.states_served.includes(lead.state))
    );
    
    if (stateMatches.length === 0) {
      return null;
    }
    
    // Filtra por categoria se disponível
    const category = lead.category || "general";
    const categoryMatches = stateMatches.filter(s => 
      !s.categories || s.categories.length === 0 || s.categories.includes(category)
    );
    
    if (categoryMatches.length > 0) {
      return categoryMatches[Math.floor(Math.random() * categoryMatches.length)];
    }
    
    // Fallback: retorna qualquer fornecedor do estado
    return stateMatches[Math.floor(Math.random() * stateMatches.length)];
  } catch (error) {
    console.error('Error matching supplier:', error.message);
    return null;
  }
}

// ============================================================================
// BUYERS
// ============================================================================

async function getBuyers() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('buyers')
      .select('*')
      .order('last_seen_utc', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting buyers:', error.message);
    return [];
  }
}

async function upsertBuyerFromLead(lead) {
  try {
    const client = getSupabaseClient();
    
    const key = (lead.contact_email && lead.contact_email.toLowerCase())
      || (lead.contact_phone && lead.contact_phone.replace(/\D/g, ""))
      || null;
    
    if (!key) return;
    
    // Buscar buyer existente
    const { data: existing } = await client
      .from('buyers')
      .select('*')
      .eq('dedupe_key', key)
      .single();
    
    if (existing) {
      // Atualizar buyer existente
      const states = existing.states || {};
      const intents = existing.intents || {};
      
      states[lead.state || "?"] = true;
      intents[lead.tenant || "federal-micro-purchase-fastlane"] = true;
      
      await client
        .from('buyers')
        .update({
          last_seen_utc: new Date().toISOString(),
          contact_email: lead.contact_email || existing.contact_email,
          contact_phone: lead.contact_phone || existing.contact_phone,
          states,
          intents,
          authorized_under_15k: lead.authorized_under_15k || existing.authorized_under_15k,
          buyer_type: lead.buyer_type || existing.buyer_type
        })
        .eq('dedupe_key', key);
    } else {
      // Criar novo buyer
      const states = {};
      const intents = {};
      states[lead.state || "?"] = true;
      intents[lead.tenant || "federal-micro-purchase-fastlane"] = true;
      
      await client
        .from('buyers')
        .insert({
          id: randomId('buyer'),
          dedupe_key: key,
          contact_email: lead.contact_email || "",
          contact_phone: lead.contact_phone || "",
          states,
          intents,
          authorized_under_15k: !!lead.authorized_under_15k,
          buyer_type: lead.buyer_type || "public"
        });
    }
  } catch (error) {
    console.error('Error upserting buyer:', error.message);
  }
}

// ============================================================================
// SETTINGS
// ============================================================================

async function getSettings() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('settings')
      .select('*');
    
    if (error) {
      console.error('Supabase error getting settings:', error);
      throw error;
    }
    
    // Converter para objeto simples
    const settings = {};
    if (data && Array.isArray(data)) {
      data.forEach(row => {
        if (row && row.key !== undefined) {
          settings[row.key] = row.value;
        }
      });
    }
    
    console.log(`[getSettings] Loaded ${Object.keys(settings).length} settings from Supabase`);
    return settings;
  } catch (error) {
    console.error('Error getting settings:', error.message, error);
    return {};
  }
}

async function updateSetting(key, value) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating setting:', error.message);
    return null;
  }
}

// ============================================================================
// TENANTS
// ============================================================================

async function getTenants() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tenants')
      .select('*')
      .eq('active', true);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting tenants:', error.message);
    return [];
  }
}

async function createTenant(tenant) {
  try {
    const client = getSupabaseClient();
    
    if (!tenant.id) {
      tenant.id = randomId('tenant');
    }
    
    const { data, error } = await client
      .from('tenants')
      .insert(tenant)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating tenant:', error.message);
    return null;
  }
}

async function updateTenant(id, updates) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating tenant:', error.message);
    return null;
  }
}

// ============================================================================
// CRAWLER QUEUE
// ============================================================================

async function getCrawlerQueue(filters = {}) {
  try {
    const client = getSupabaseClient();
    let query = client.from('crawler_queue').select('*');
    
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }
    
    query = query.order('priority', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting crawler queue:', error.message);
    return [];
  }
}

async function updateCrawlerQueueItem(id, updates) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('crawler_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating crawler queue item:', error.message);
    return null;
  }
}

async function createCrawlerQueueItem(item) {
  try {
    const client = getSupabaseClient();
    
    if (!item.id) {
      item.id = randomId('crawler');
    }
    
    const { data, error } = await client
      .from('crawler_queue')
      .insert(item)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating crawler queue item:', error.message);
    return null;
  }
}

// ============================================================================
// INTEL REPORTS
// ============================================================================

async function getIntelReports(limit = 10) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('intel_reports')
      .select('*')
      .order('created_utc', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting intel reports:', error.message);
    return [];
  }
}

async function createIntelReport(report) {
  try {
    const client = getSupabaseClient();
    
    if (!report.id) {
      report.id = randomId('intel');
    }
    
    const { data, error } = await client
      .from('intel_reports')
      .insert(report)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating intel report:', error.message);
    return null;
  }
}

// ============================================================================
// UTILS
// ============================================================================

function randomId(prefix) {
  return prefix + "-" +
    Math.random().toString(36).slice(2, 8) + "-" +
    Date.now().toString(36);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS,DELETE",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getSupabaseClient,
  
  // Leads
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeads,
  
  // Suppliers
  getSuppliers,
  createSupplier,
  matchSupplierForLead,
  
  // Buyers
  getBuyers,
  upsertBuyerFromLead,
  
  // Settings
  getSettings,
  updateSetting,
  
  // Tenants
  getTenants,
  createTenant,
  updateTenant,
  
  // Crawler Queue
  getCrawlerQueue,
  updateCrawlerQueueItem,
  createCrawlerQueueItem,
  
  // Intel Reports
  getIntelReports,
  createIntelReport,
  
  // Utils
  randomId,
  corsHeaders
};
