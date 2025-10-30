# 🚀 Production Deployment Guide - BrokerChain v27.0

## 📋 OVERVIEW

Este guia fornece instruções completas para deploy e operação em produção no Netlify pago, com persistência total via Supabase e automações completas.

---

## ✅ PRÉ-REQUISITOS

### Contas Necessárias
- [ ] Netlify (plano pago recomendado para cron jobs ilimitados)
- [ ] Supabase (plano gratuito suficiente para começar)
- [ ] Stripe (para processar pagamentos)
- [ ] DocuSign (para assinaturas digitais)
- [ ] OpenAI (para qualificação de leads e geração de outreach)

### Checklist de Configuração
- [ ] Repositório GitHub configurado
- [ ] Domínio personalizado (opcional mas recomendado)
- [ ] Email profissional configurado (para inbox monitoring)

---

## 🔐 CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE

### No Netlify

Acesse: **Site settings** → **Environment variables** → **Add a variable**

#### Supabase (OBRIGATÓRIO)
```
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...
```

#### OpenAI (OBRIGATÓRIO)
```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
```

#### Stripe (OBRIGATÓRIO para Billing)
```
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_SUCCESS_URL=https://seu-dominio.com/dashboard.html
STRIPE_CANCEL_URL=https://seu-dominio.com/dashboard.html
```

#### DocuSign (OBRIGATÓRIO para Contratos)
```
DOCUSIGN_BASE_URL=https://na3.docusign.net/restapi
DOCUSIGN_ACCOUNT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DOCUSIGN_ACCESS_TOKEN=eyJ0eXAiOiJNVCIsImFsZyI6...
DOCUSIGN_TEMPLATE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### Email (Opcional - para inbox automation)
```
EMAIL_IMAP_USER=contact@seudominio.com
EMAIL_IMAP_PASS=sua-senha-imap
EMAIL_SMTP_USER=contact@seudominio.com
EMAIL_SMTP_PASS=sua-senha-smtp
```

---

## 📊 SETUP DO SUPABASE

### 1. Criar Projeto

1. Acesse https://supabase.com
2. Clique em **"New Project"**
3. Configure:
   - Nome: `brokerchain-prod`
   - Senha forte para o banco
   - Região: `us-east-1` (EUA) ou `sa-east-1` (Brasil)
4. Aguarde 2 minutos

### 2. Executar Schema SQL

1. No Supabase, vá em **SQL Editor**
2. Clique em **"New query"**
3. Copie todo o conteúdo de `supabase-schema.sql`
4. Cole no editor
5. Clique em **"Run"** (Ctrl+Enter)
6. Verifique se todas as tabelas foram criadas

### 3. Obter Credenciais

1. Vá em **Project Settings** → **API**
2. Copie:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_KEY`
3. Configure no Netlify

### 4. Verificar Dados Iniciais

No **Table Editor**, verifique se as tabelas têm dados iniciais:
- `settings` - deve ter ~12 configurações
- `tenants` - deve ter 4 tenants

---

## 🌐 CONFIGURAÇÃO DE WEBHOOKS

### Stripe Webhooks

1. No Stripe Dashboard, vá em **Developers** → **Webhooks**
2. Clique em **"Add endpoint"**
3. URL: `https://seu-dominio.netlify.app/api/stripe-webhook`
4. Eventos a escutar:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copie o **Signing Secret** (webhook secret)
6. Configure no Netlify como `STRIPE_WEBHOOK_SECRET`

### DocuSign Webhooks

1. No DocuSign, vá em **Settings** → **Connect**
2. Configure um novo webhook
3. URL: `https://seu-dominio.netlify.app/api/docusign-webhook`
4. Eventos a escutar:
   - `envelope-completed`
   - `envelope-declined`
   - `envelope-voided`

---

## 📅 CRON JOBS AUTOMÁTICOS

O arquivo `netlify.toml` já configura os seguintes cron jobs:

| Função | Frequência | Descrição |
|--------|-----------|-----------|
| `email-inbox` | 5 min | Monitora emails recebidos |
| `scrape-leads` | 10 min | Gera leads de compradores |
| `scrape-suppliers` | 1 hora | Gera fornecedores |
| `brain` | 5 min | Qualifica leads |
| `outreach-email` | 30 min | Gera drafts de outreach |
| `dispatch` | 5 min | Auto-dispatch de leads |
| `crawl-run` | 5 min | Coleta de fontes públicas |
| `intel-advisor-run` | 5 min | Inteligência de mercado |
| `supplier-outreach-run` | Diário 13h UTC | Outreach para fornecedores |

### Verificar Cron Jobs

1. No Netlify, vá em **Functions** → **Scheduled Functions**
2. Verifique se todos os cron jobs estão ativos
3. Monitore os logs de execução

---

## 🔍 MONITORAMENTO E ANALYTICS

### Netlify Analytics (Recomendado)

1. Ative o Netlify Analytics no painel
2. Custo: ~$9/mês
3. Fornece:
   - Pageviews
   - Unique visitors
   - Top pages
   - Bandwidth usage

### Google Analytics (Opcional)

Adicione no `<head>` de cada página HTML:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Logs e Alertas

#### Verificar Logs de Funções

1. Netlify → **Functions** → Selecione uma função
2. Veja logs em tempo real
3. Filtre por erros ou warnings

#### Configurar Alertas

No Supabase:
1. Vá em **Database** → **Webhooks**
2. Configure webhook para alertas críticos
3. Envie para serviço de notificação (ex: Slack, Discord)

---

## 🛡️ SEGURANÇA

### Validações Implementadas

- ✅ Todas as credenciais em variáveis de ambiente
- ✅ CORS configurado para permitir apenas domínios autorizados
- ✅ Retry logic com exponential backoff
- ✅ Tratamento de erros em todas as funções
- ✅ Validação de webhooks

### Recomendações Adicionais

1. **Habilitar RLS no Supabase** (Row Level Security):
   ```sql
   ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Allow all operations" ON leads FOR ALL USING (true);
   ```

2. **Rate Limiting**: Configure no Netlify para prevenir abuso

3. **Backups**: Configure backups automáticos no Supabase

4. **Domínio Personalizado**: Use HTTPS com certificado SSL

---

## 📈 OTIMIZAÇÃO DE PERFORMANCE

### Índices do Banco de Dados

Já configurados no schema:
- `idx_leads_status` - busca por status
- `idx_leads_tenant` - busca por tenant
- `idx_leads_state` - busca por estado
- `idx_suppliers_state` - busca de fornecedores por estado
- `idx_crawler_active` - busca de fontes ativas

### Queries Otimizadas

Todas as queries usam índices apropriados e filtros eficientes.

### Caching

As funções serverless do Netlify têm cache automático de 1 hora para assets estáticos.

---

## 🧪 TESTES

### Testar Persistência

1. Gere alguns leads no dashboard
2. Faça um novo deploy (Trigger deploy)
3. Verifique se os leads persistem ✅

### Testar Stripe

1. Use chaves de teste (`sk_test_...`)
2. Use cartão de teste: `4242 4242 4242 4242`
3. Verifique webhook no dashboard do Stripe

### Testar DocuSign

1. Use ambiente de sandbox/demo
2. Use email de teste
3. Verifique assinatura no dashboard

### Testar Cron Jobs

Execute manualmente no dashboard:
1. Clique no botão "Scrape Buyers USA"
2. Clique em "Qualificar (Brain)"
3. Clique em "Despachar"
4. Verifique logs

---

## 🚨 TROUBLESHOOTING

### Erro: "Supabase not configured"

**Solução:**
1. Verifique se `SUPABASE_URL` e `SUPABASE_KEY` estão no Netlify
2. Trigger deploy após adicionar variáveis

### Erro: "relation does not exist"

**Solução:**
1. Execute o schema SQL completo no Supabase
2. Verifique se todas as tabelas foram criadas

### Leads não persistem

**Solução:**
1. Verifique logs do Netlify Functions
2. Verifique logs do Supabase
3. Teste criar lead manualmente via API

### Stripe/DocuSign não funciona

**Solução:**
1. Verifique se as credenciais estão corretas
2. Verifique se o ambiente (test/prod) está correto
3. Verifique logs de erro nas funções

---

## 📞 SUPORTE

### Documentação

- **Netlify**: https://docs.netlify.com/
- **Supabase**: https://supabase.com/docs
- **Stripe**: https://stripe.com/docs
- **DocuSign**: https://developers.docusign.com/

### Comunidades

- **Netlify Community**: https://answers.netlify.com/
- **Supabase Discord**: https://discord.supabase.com/

---

## ✅ CHECKLIST DE PRODUÇÃO

Antes de considerar o sistema pronto para produção:

### Configuração
- [ ] Supabase configurado e schema executado
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Webhooks do Stripe configurados
- [ ] Webhooks do DocuSign configurados
- [ ] Domínio personalizado configurado (opcional)
- [ ] SSL/HTTPS ativo

### Testes
- [ ] Persistência testada e funcionando
- [ ] Stripe funcionando em modo de teste
- [ ] DocuSign funcionando em ambiente demo
- [ ] Cron jobs executando corretamente
- [ ] Dashboard carrega sem erros
- [ ] Geração de leads funciona
- [ ] Qualificação (Brain) funciona
- [ ] Auto-dispatch funciona

### Monitoramento
- [ ] Netlify Analytics ativo (opcional)
- [ ] Google Analytics configurado (opcional)
- [ ] Alertas configurados
- [ ] Logs sendo monitorados

### Segurança
- [ ] Credenciais em produção (não test)
- [ ] RLS habilitado no Supabase (recomendado)
- [ ] Rate limiting configurado
- [ ] Backups automáticos ativos

### Documentação
- [ ] README atualizado
- [ ] Credenciais documentadas (com segurança)
- [ ] Processos operacionais documentados

---

**✨ Seu BrokerChain está pronto para produção! ✨**

*BrokerChain v27.0 - Emergency Sourcing & Rapid Dispatch*  
*Powered by Netlify Functions + Supabase PostgreSQL*
