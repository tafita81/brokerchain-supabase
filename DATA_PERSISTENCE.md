# ⚠️ IMPORTANTE: Persistência de Dados no Netlify

## 🚨 PROBLEMA CRÍTICO

Os arquivos JSON na pasta `data/` são **READ-ONLY** após o deploy no Netlify. Isso significa que:

- ✅ As funções podem **LER** os dados
- ❌ As funções **NÃO PODEM GRAVAR** novos dados permanentemente
- ❌ Qualquer alteração é **PERDIDA** após o próximo deploy

## 📊 IMPACTO

### O Que Funciona (Modo Demonstração)
- ✅ Landing page e dashboard carregam
- ✅ Funções serverless executam
- ✅ Leitura de dados iniciais (suppliers, settings)
- ✅ Geração temporária de leads (perdidos após deploy)

### O Que NÃO Funciona (Produção Real)
- ❌ Salvar novos leads permanentemente
- ❌ Atualizar status de leads
- ❌ Registrar compradores
- ❌ Histórico de transações Stripe/DocuSign
- ❌ Qualquer persistência de dados entre deploys

## ✅ SOLUÇÕES RECOMENDADAS

### Opção 1: Supabase (RECOMENDADO - Gratuito)

**Por que Supabase?**
- ✅ PostgreSQL gerenciado (gratuito até 500MB)
- ✅ API REST automática
- ✅ Realtime subscriptions
- ✅ Autenticação integrada
- ✅ Fácil integração com Netlify

**Como Implementar:**

1. **Criar conta no Supabase**
   - Acesse https://supabase.com
   - Crie um projeto gratuito

2. **Criar tabelas**
   ```sql
   -- Tabela de leads
   CREATE TABLE leads (
     id TEXT PRIMARY KEY,
     created_utc TIMESTAMP DEFAULT NOW(),
     dedup_hash TEXT UNIQUE,
     buyer_type TEXT,
     state TEXT,
     urgency TEXT,
     tenant TEXT,
     authorized_under_15k BOOLEAN,
     contact_email TEXT,
     contact_phone TEXT,
     title TEXT,
     body TEXT,
     source_url TEXT,
     source_channel TEXT,
     status TEXT,
     sale_ready BOOLEAN,
     category TEXT,
     zip TEXT,
     assigned_supplier_id TEXT,
     assigned_supplier_contact JSONB,
     dispatch_assigned_utc TIMESTAMP,
     stripe_checkout_url TEXT,
     stripe_session_id TEXT,
     stripe_created_utc TIMESTAMP,
     docusign_envelope_id TEXT,
     docusign_created_utc TIMESTAMP,
     alert_pending BOOLEAN,
     alert_reason TEXT
   );

   -- Tabela de suppliers
   CREATE TABLE suppliers (
     id TEXT PRIMARY KEY,
     name TEXT,
     business_name TEXT,
     state TEXT,
     states_served TEXT[],
     categories TEXT[],
     email TEXT,
     phone TEXT,
     phone24h TEXT,
     billing_pref TEXT,
     created_utc TIMESTAMP DEFAULT NOW()
   );

   -- Tabela de buyers
   CREATE TABLE buyers (
     id TEXT PRIMARY KEY,
     dedupe_key TEXT UNIQUE,
     first_seen_utc TIMESTAMP DEFAULT NOW(),
     last_seen_utc TIMESTAMP,
     contact_email TEXT,
     contact_phone TEXT,
     states JSONB,
     intents JSONB,
     authorized_under_15k BOOLEAN,
     buyer_type TEXT
   );

   -- Tabela de settings
   CREATE TABLE settings (
     key TEXT PRIMARY KEY,
     value JSONB,
     updated_utc TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Instalar cliente Supabase**
   ```bash
   npm install @supabase/supabase-js
   ```

4. **Atualizar _util.js**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_KEY
   );
   
   async function readJSON(fname) {
     // Mapear arquivo para tabela
     const table = fname.replace('.json', '');
     const { data, error } = await supabase.from(table).select('*');
     return data || [];
   }
   
   async function writeJSON(fname, obj) {
     const table = fname.replace('.json', '');
     // Implementar lógica de upsert
   }
   ```

5. **Configurar variáveis de ambiente no Netlify**
   - `SUPABASE_URL` = URL do seu projeto
   - `SUPABASE_KEY` = Anon/Public key

### Opção 2: Firebase Firestore

**Como Implementar:**

1. Criar projeto no Firebase
2. Ativar Firestore Database
3. Instalar: `npm install firebase-admin`
4. Configurar credenciais no Netlify
5. Atualizar funções para usar Firestore

### Opção 3: PostgreSQL (Neon, Railway, etc.)

**Como Implementar:**

1. Criar banco PostgreSQL gratuito (Neon.tech)
2. Instalar: `npm install pg`
3. Configurar connection string no Netlify
4. Criar schema SQL
5. Atualizar funções para usar queries SQL

### Opção 4: Netlify Blobs (Limitado)

**Como Implementar:**

1. Usar Netlify Blobs API (beta)
2. Limitado a 1GB no plano gratuito
3. Não é um banco de dados real
4. Boa para cache simples

## 🔧 IMPLEMENTAÇÃO RÁPIDA (Supabase)

Criei um exemplo de como adaptar o código:

### Novo arquivo: `functions/_supabase.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

async function getLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_utc', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

async function saveLead(lead) {
  const { data, error } = await supabase
    .from('leads')
    .upsert(lead, { onConflict: 'id' })
    .select();
  
  if (error) throw error;
  return data[0];
}

async function updateLead(id, updates) {
  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
}

module.exports = {
  supabase,
  getLeads,
  saveLead,
  updateLead
};
```

### Atualizar `functions/marketplace.js`

```javascript
const { getLeads } = require('./_supabase.js');
const { corsHeaders } = require('./_util.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }

  try {
    const leads = await getLeads();
    
    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true, leads})
    };
  } catch (error) {
    return {
      statusCode:500,
      headers:corsHeaders(),
      body:JSON.stringify({ok:false, error: error.message})
    };
  }
};
```

## 📝 CHECKLIST DE MIGRAÇÃO

- [ ] Criar conta Supabase/Firebase
- [ ] Criar tabelas/coleções
- [ ] Instalar dependências (`@supabase/supabase-js`)
- [ ] Criar arquivo `_supabase.js` ou `_firebase.js`
- [ ] Atualizar `_util.js` para usar banco de dados
- [ ] Atualizar todas as funções que usam `readJSON/writeJSON`
- [ ] Configurar variáveis de ambiente no Netlify
- [ ] Testar localmente com `netlify dev`
- [ ] Fazer deploy e testar em produção
- [ ] Migrar dados iniciais (suppliers, settings) para o banco

## 🚀 PRÓXIMOS PASSOS

1. **Curto Prazo (Esta Semana)**
   - Escolher solução de persistência (recomendo Supabase)
   - Criar conta e configurar banco
   - Migrar função `marketplace.js` (teste)

2. **Médio Prazo (Este Mês)**
   - Migrar todas as funções
   - Testar fluxo completo
   - Documentar queries e schemas

3. **Longo Prazo**
   - Implementar backups automáticos
   - Adicionar índices para performance
   - Monitorar uso e custos

## ⚠️ AVISO FINAL

**O projeto atual funciona como DEMONSTRAÇÃO**, mas **NÃO é adequado para produção** sem migração para banco de dados real.

Sem persistência, você perderá:
- Todos os leads gerados
- Histórico de transações
- Dados de compradores
- Configurações alteradas

**Recomendação**: Migre para Supabase antes de usar em produção.
