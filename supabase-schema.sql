-- BrokerChain v27.0 - Supabase Schema
-- Execute este script no Supabase SQL Editor
-- https://app.supabase.com/ → SQL Editor → New Query

-- ============================================================================
-- TABELA: leads
-- Armazena todos os leads (compradores urgentes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dedup_hash TEXT UNIQUE,
  
  -- Informações do comprador
  buyer_type TEXT NOT NULL DEFAULT 'public',
  state TEXT,
  urgency TEXT,
  tenant TEXT NOT NULL DEFAULT 'federal-micro-purchase-fastlane',
  authorized_under_15k BOOLEAN DEFAULT false,
  
  -- Contato
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Detalhes do lead
  title TEXT,
  body TEXT,
  need TEXT,
  category TEXT,
  zip TEXT DEFAULT '00000',
  
  -- Origem
  source_url TEXT,
  source_channel TEXT DEFAULT 'crawler',
  
  -- Status e qualificação
  status TEXT DEFAULT 'scraped',
  sale_ready BOOLEAN DEFAULT false,
  ai_missing_questions JSONB DEFAULT '[]'::jsonb,
  promoted_utc TIMESTAMP WITH TIME ZONE,
  
  -- Fornecedor atribuído
  assigned_supplier_id TEXT,
  assigned_supplier_contact JSONB,
  dispatch_assigned_utc TIMESTAMP WITH TIME ZONE,
  
  -- Stripe
  stripe_checkout_url TEXT,
  stripe_session_id TEXT,
  stripe_created_utc TIMESTAMP WITH TIME ZONE,
  stripe_error TEXT,
  
  -- DocuSign
  docusign_envelope_id TEXT,
  docusign_created_utc TIMESTAMP WITH TIME ZONE,
  docusign_error TEXT,
  
  -- Alertas e bloqueios
  alert_pending BOOLEAN DEFAULT false,
  alert_reason TEXT,
  billing_block_reason TEXT,
  
  -- Metadados
  updated_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_leads_sale_ready ON leads(sale_ready) WHERE sale_ready = true;
CREATE INDEX IF NOT EXISTS idx_leads_dedup ON leads(dedup_hash);

-- ============================================================================
-- TABELA: suppliers
-- Armazena fornecedores de plantão
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  created_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Informações básicas
  name TEXT NOT NULL,
  business_name TEXT,
  
  -- Localização
  state TEXT NOT NULL,
  states_served TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Categorias de serviço
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Contato
  email TEXT,
  phone TEXT,
  phone24h TEXT,
  
  -- Preferências
  billing_pref TEXT DEFAULT 'card',
  active BOOLEAN DEFAULT true,
  
  -- Metadados
  updated_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_suppliers_state ON suppliers(state);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_suppliers_categories ON suppliers USING GIN(categories);

-- ============================================================================
-- TABELA: buyers
-- Armazena compradores registrados (dedupe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS buyers (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT UNIQUE NOT NULL,
  
  -- Timestamps
  first_seen_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contato
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Histórico
  states JSONB DEFAULT '{}'::jsonb,
  intents JSONB DEFAULT '{}'::jsonb,
  
  -- Autorização
  authorized_under_15k BOOLEAN DEFAULT false,
  buyer_type TEXT DEFAULT 'public',
  
  -- Metadados
  updated_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_buyers_dedupe ON buyers(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(contact_email);

-- ============================================================================
-- TABELA: settings
-- Armazena configurações do sistema (key-value)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO settings (key, value) VALUES
  ('AUTO_DISPATCH_ENABLED', 'true'::jsonb),
  ('SCRAPER_ENABLED', 'true'::jsonb),
  ('OUTREACH_ENABLED', 'true'::jsonb),
  ('BRAIN_ENABLED', 'true'::jsonb),
  ('BILLING_ENABLED', 'true'::jsonb),
  ('DOCUSIGN_ENABLED', 'true'::jsonb),
  ('INBOX_ENABLED', 'true'::jsonb),
  ('CRAWLER_ENABLED', 'true'::jsonb),
  ('INTEL_ADVISOR_ENABLED', 'true'::jsonb),
  ('DAILY_SUPPLIER_PING_ENABLED', 'true'::jsonb),
  ('ALERT_EMAIL', '"contact@blokerchain.business"'::jsonb),
  ('PRODUCTION_READY', 'false'::jsonb),
  ('BILLING_READY', 'false'::jsonb),
  ('EMAIL_READY', 'false'::jsonb),
  ('APPROVED_OUTREACH', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TABELA: tenants
-- Armazena configuração dos tenants (linhas de negócio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir tenants padrão
INSERT INTO tenants (id, name, description, config) VALUES
  ('emergency-dispatch-exchange', 'Emergency Dispatch Exchange', 'Emergências privadas/comerciais/residenciais', '{}'::jsonb),
  ('federal-micro-purchase-fastlane', 'Federal Micro-Purchase Fastlane', 'Setor público/infraestrutura crítica até ~15k USD', '{}'::jsonb),
  ('solar-home-us', 'Solar Home US', 'Painéis solares residenciais antes do corte de crédito fiscal', '{}'::jsonb),
  ('global-sourcing-b2b', 'Global Sourcing B2B', 'Suprimento industrial / MRO / EPI / peças críticas', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TABELA: email_inbox
-- Armazena emails recebidos para processamento
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_inbox (
  id TEXT PRIMARY KEY,
  received_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  from_email TEXT,
  subject TEXT,
  body TEXT,
  processed BOOLEAN DEFAULT false,
  lead_id TEXT REFERENCES leads(id),
  created_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_processed ON email_inbox(processed) WHERE processed = false;

-- ============================================================================
-- TABELA: crawler_queue
-- Fila de URLs para crawling
-- ============================================================================
CREATE TABLE IF NOT EXISTS crawler_queue (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  source TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_utc TIMESTAMP WITH TIME ZONE,
  created_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_status ON crawler_queue(status, priority DESC);

-- ============================================================================
-- TABELA: intel_reports
-- Relatórios de inteligência gerados
-- ============================================================================
CREATE TABLE IF NOT EXISTS intel_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT,
  data JSONB NOT NULL,
  created_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intel_created ON intel_reports(created_utc DESC);

-- ============================================================================
-- FUNÇÕES E TRIGGERS
-- ============================================================================

-- Função para atualizar updated_utc automaticamente
CREATE OR REPLACE FUNCTION update_updated_utc()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_utc = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_utc
CREATE TRIGGER update_leads_updated_utc
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_utc();

CREATE TRIGGER update_suppliers_updated_utc
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_utc();

CREATE TRIGGER update_buyers_updated_utc
  BEFORE UPDATE ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_utc();

CREATE TRIGGER update_settings_updated_utc
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_utc();

CREATE TRIGGER update_tenants_updated_utc
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_utc();

-- ============================================================================
-- POLÍTICAS RLS (Row Level Security) - DESABILITADAS PARA SIMPLIFICAR
-- ============================================================================
-- Para produção, considere habilitar RLS e criar políticas adequadas
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations" ON leads FOR ALL USING (true);

-- ============================================================================
-- VIEWS ÚTEIS
-- ============================================================================

-- View de leads prontos para dispatch
CREATE OR REPLACE VIEW leads_ready_for_dispatch AS
SELECT * FROM leads
WHERE sale_ready = true
  AND status = 'new'
ORDER BY created_utc ASC;

-- View de leads com alertas
CREATE OR REPLACE VIEW leads_with_alerts AS
SELECT * FROM leads
WHERE alert_pending = true
ORDER BY created_utc DESC;

-- View de estatísticas por tenant
CREATE OR REPLACE VIEW stats_by_tenant AS
SELECT 
  tenant,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE status = 'new') as new_leads,
  COUNT(*) FILTER (WHERE sale_ready = true) as sale_ready_leads,
  COUNT(*) FILTER (WHERE stripe_session_id IS NOT NULL) as with_stripe,
  COUNT(*) FILTER (WHERE docusign_envelope_id IS NOT NULL) as with_docusign,
  COUNT(*) FILTER (WHERE alert_pending = true) as with_alerts
FROM leads
GROUP BY tenant;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON TABLE leads IS 'Leads de compradores urgentes';
COMMENT ON TABLE suppliers IS 'Fornecedores de plantão';
COMMENT ON TABLE buyers IS 'Compradores registrados (dedupe)';
COMMENT ON TABLE settings IS 'Configurações do sistema (key-value)';
COMMENT ON TABLE tenants IS 'Linhas de negócio (tenants)';

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================

-- Para verificar se tudo foi criado corretamente:
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
