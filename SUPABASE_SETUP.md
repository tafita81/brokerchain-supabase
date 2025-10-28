# 🚀 Guia de Setup Supabase - BrokerChain v27.0

## 📋 VISÃO GERAL

Este guia mostra como configurar o Supabase (banco de dados PostgreSQL gratuito) para o BrokerChain funcionar em produção com persistência real de dados.

**Tempo estimado**: 15-20 minutos

---

## 🎯 POR QUE SUPABASE?

✅ **Gratuito**: Até 500MB de banco + 2GB de transferência/mês  
✅ **PostgreSQL**: Banco de dados robusto e confiável  
✅ **API REST automática**: Não precisa escrever queries SQL manualmente  
✅ **Realtime**: Suporte a subscriptions em tempo real  
✅ **Fácil integração**: SDK JavaScript oficial  
✅ **Backups automáticos**: Seus dados estão seguros  

---

## 📝 PASSO A PASSO

### 1. Criar Conta no Supabase

1. Acesse https://supabase.com
2. Clique em **"Start your project"**
3. Faça login com GitHub, Google ou email
4. **Gratuito** - não precisa cartão de crédito

---

### 2. Criar Novo Projeto

1. No dashboard, clique em **"New Project"**
2. Preencha:
   - **Name**: `brokerchain` (ou qualquer nome)
   - **Database Password**: Crie uma senha forte (guarde bem!)
   - **Region**: Escolha o mais próximo dos seus usuários
     - `us-east-1` (Virginia, EUA) - recomendado para EUA
     - `sa-east-1` (São Paulo, Brasil) - recomendado para Brasil
3. Clique em **"Create new project"**
4. Aguarde ~2 minutos enquanto o projeto é provisionado

---

### 3. Executar o Schema SQL

1. No menu lateral, clique em **"SQL Editor"**
2. Clique em **"New query"**
3. Abra o arquivo `supabase-schema.sql` (na raiz do projeto)
4. **Copie TODO o conteúdo** do arquivo
5. **Cole** no SQL Editor do Supabase
6. Clique em **"Run"** (ou pressione Ctrl+Enter)
7. Você verá uma mensagem de sucesso ✅

**O que foi criado:**
- 9 tabelas (leads, suppliers, buyers, settings, tenants, etc.)
- Índices para performance
- Triggers para atualização automática de timestamps
- Views úteis para consultas
- Dados iniciais (settings e tenants)

---

### 4. Obter Credenciais do Supabase

1. No menu lateral, clique em **"Project Settings"** (ícone de engrenagem)
2. Clique em **"API"** no submenu
3. Você verá duas informações importantes:

**Project URL** (SUPABASE_URL):
```
https://xxxxxxxxxxxxx.supabase.co
```

**anon/public key** (SUPABASE_KEY):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5OTk5OTksImV4cCI6MjAxNTU3NTk5OX0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

4. **Copie e guarde** essas duas informações

⚠️ **IMPORTANTE**: Use a chave **anon/public**, NÃO a service_role (que é secreta)

---

### 5. Configurar Variáveis de Ambiente no Netlify

#### Opção A: Via Interface Web

1. Acesse https://app.netlify.com/
2. Selecione seu site
3. Vá em **Site settings** → **Environment variables**
4. Clique em **"Add a variable"**
5. Adicione as duas variáveis:

```
Key: SUPABASE_URL
Value: https://xxxxxxxxxxxxx.supabase.co

Key: SUPABASE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

6. Clique em **"Save"**

#### Opção B: Via Netlify CLI

```bash
netlify env:set SUPABASE_URL "https://xxxxxxxxxxxxx.supabase.co"
netlify env:set SUPABASE_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 6. Fazer Deploy

1. Se já fez deploy antes, faça **Trigger deploy**:
   - Deploys → Trigger deploy → Deploy site

2. Se ainda não fez deploy, siga o guia em `DEPLOY_GUIDE.md`

---

### 7. Testar a Integração

#### Teste 1: Verificar Settings

Acesse: `https://seu-site.netlify.app/api/settings`

**Esperado:**
```json
{
  "ok": true,
  "settings": {
    "AUTO_DISPATCH_ENABLED": true,
    "SCRAPER_ENABLED": true,
    "BRAIN_ENABLED": true,
    ...
  }
}
```

#### Teste 2: Gerar Leads

1. Acesse: `https://seu-site.netlify.app/dashboard.html`
2. Clique em **"Scrape Buyers USA"**
3. Aguarde alguns segundos
4. A tabela deve mostrar leads gerados

#### Teste 3: Verificar Persistência

1. Gere alguns leads (teste 2)
2. Faça um novo deploy (Trigger deploy)
3. Acesse o dashboard novamente
4. **Os leads devem continuar lá!** ✅

Se os leads persistirem após o deploy, **parabéns!** O Supabase está funcionando.

---

## 🔍 VERIFICAR DADOS NO SUPABASE

### Ver Tabelas e Dados

1. No Supabase, clique em **"Table Editor"** no menu lateral
2. Você verá todas as tabelas criadas
3. Clique em qualquer tabela para ver os dados
4. Você pode editar, adicionar ou deletar registros manualmente

### Executar Queries SQL

1. Clique em **"SQL Editor"**
2. Crie uma nova query
3. Exemplos:

```sql
-- Ver todos os leads
SELECT * FROM leads ORDER BY created_utc DESC LIMIT 10;

-- Ver leads prontos para dispatch
SELECT * FROM leads WHERE sale_ready = true AND status = 'new';

-- Ver estatísticas por tenant
SELECT * FROM stats_by_tenant;

-- Contar leads por estado
SELECT state, COUNT(*) as total
FROM leads
GROUP BY state
ORDER BY total DESC
LIMIT 10;

-- Ver fornecedores ativos
SELECT * FROM suppliers WHERE active = true;

-- Ver compradores registrados
SELECT * FROM buyers ORDER BY last_seen_utc DESC;
```

---

## 📊 MONITORAMENTO

### Dashboard do Supabase

1. **Database**: Veja uso de espaço, conexões, queries
2. **API**: Veja requisições por minuto, latência
3. **Logs**: Veja logs de queries e erros

### Limites do Plano Gratuito

| Recurso | Limite Gratuito |
|---------|-----------------|
| Espaço em disco | 500 MB |
| Transferência | 2 GB/mês |
| Requisições API | Ilimitadas |
| Conexões simultâneas | 60 |
| Backups | 7 dias |

**Dica**: Para a maioria dos casos de uso, o plano gratuito é mais que suficiente.

---

## 🔧 TROUBLESHOOTING

### Erro: "Supabase not configured"

**Causa**: Variáveis de ambiente não configuradas

**Solução**:
1. Verifique se `SUPABASE_URL` e `SUPABASE_KEY` estão configuradas no Netlify
2. Verifique se não há espaços extras nos valores
3. Trigger deploy após adicionar variáveis

### Erro: "relation does not exist"

**Causa**: Schema SQL não foi executado

**Solução**:
1. Vá no SQL Editor do Supabase
2. Execute o arquivo `supabase-schema.sql` completo
3. Verifique se todas as tabelas foram criadas (Table Editor)

### Erro: "Failed to fetch"

**Causa**: Projeto Supabase pausado (inatividade)

**Solução**:
1. Projetos gratuitos pausam após 1 semana de inatividade
2. No dashboard do Supabase, clique em **"Restore"**
3. Aguarde alguns minutos
4. Teste novamente

### Leads não aparecem após deploy

**Causa**: Possível erro na criação de leads

**Solução**:
1. Verifique os logs do Netlify (Deploys → último deploy → Function log)
2. Verifique os logs do Supabase (Logs → API)
3. Teste criar um lead manual via API:

```bash
curl -X POST https://seu-site.netlify.app/api/manual-lead \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_type": "public",
    "state": "CA",
    "urgency": "today",
    "title": "Test lead",
    "need": "Testing Supabase integration",
    "contact_email": "test@example.com"
  }'
```

---

## 🔐 SEGURANÇA

### Row Level Security (RLS)

Por padrão, o RLS está **desabilitado** para simplificar o setup inicial.

Para produção, considere habilitar:

```sql
-- Habilitar RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

-- Criar políticas (exemplo)
CREATE POLICY "Allow all operations" ON leads
  FOR ALL USING (true);
```

### Chaves de API

- **anon/public key**: Pode ser exposta no frontend (já está protegida por RLS)
- **service_role key**: NUNCA exponha no frontend ou código público

---

## 📈 PRÓXIMOS PASSOS

### Curto Prazo

1. ✅ Testar geração de leads
2. ✅ Testar qualificação (Brain)
3. ✅ Testar dispatch
4. ✅ Verificar persistência após deploy

### Médio Prazo

1. Adicionar fornecedores reais (via "Scrape Suppliers USA" ou manualmente)
2. Configurar Stripe e DocuSign
3. Testar fluxo completo (lead → dispatch → pagamento)
4. Monitorar uso do banco de dados

### Longo Prazo

1. Implementar backups adicionais (export CSV)
2. Adicionar índices customizados para queries específicas
3. Habilitar RLS para segurança adicional
4. Considerar upgrade para plano Pro se necessário ($25/mês)

---

## 💡 DICAS EXTRAS

### Export de Dados

Para fazer backup manual:

1. No Supabase, vá em **Table Editor**
2. Selecione uma tabela
3. Clique em **"..."** → **"Export to CSV"**
4. Salve o arquivo

### Import de Dados

Para importar dados (ex: fornecedores reais):

1. Prepare um arquivo CSV com as colunas corretas
2. No Supabase, vá em **Table Editor**
3. Clique em **"..."** → **"Import data from CSV"**
4. Selecione o arquivo

### Queries Úteis

```sql
-- Limpar todos os leads (cuidado!)
DELETE FROM leads;

-- Resetar settings para padrão
DELETE FROM settings;
-- Depois execute o INSERT do schema novamente

-- Ver leads com alertas
SELECT * FROM leads_with_alerts;

-- Ver leads prontos para dispatch
SELECT * FROM leads_ready_for_dispatch;
```

---

## 📞 SUPORTE

### Documentação Oficial

- **Supabase Docs**: https://supabase.com/docs
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript/introduction
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

### Comunidade

- **Supabase Discord**: https://discord.supabase.com/
- **Supabase GitHub**: https://github.com/supabase/supabase

---

## ✅ CHECKLIST FINAL

Antes de considerar o setup completo, verifique:

- [ ] Projeto Supabase criado
- [ ] Schema SQL executado com sucesso
- [ ] Variáveis `SUPABASE_URL` e `SUPABASE_KEY` configuradas no Netlify
- [ ] Deploy feito com sucesso
- [ ] API `/api/settings` retorna dados
- [ ] Dashboard carrega sem erros
- [ ] Geração de leads funciona
- [ ] Leads persistem após novo deploy
- [ ] Dados aparecem no Table Editor do Supabase

Se todos os itens estão ✅, **parabéns!** Seu BrokerChain está pronto para produção com Supabase! 🎉

---

*BrokerChain v27.0 - Emergency Sourcing & Rapid Dispatch*  
*Powered by Supabase PostgreSQL*
