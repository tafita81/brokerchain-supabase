# 🚀 Guia Completo de Deploy - BrokerChain v26.0

## ✅ CORREÇÕES IMPLEMENTADAS

Esta versão **v26.0** corrige todas as micro lacunas encontradas na v25.0:

### 🔧 Correções de Código

1. **✅ _util.js**
   - Adicionada função `saveLeads()` (estava faltando)
   - Adicionada função `matchSupplierForLead()` (estava faltando)
   - Adicionada função `randomId()` ao export
   - Melhorado tratamento de erros em `readJSON/writeJSON`
   - Criação automática de diretórios se não existirem

2. **✅ dispatch.js**
   - Corrigido uso de `lead.email` → `lead.contact_email`
   - Corrigido import de `saveLeads` de `_util.js`
   - Corrigido uso de `writeJSON` ao invés de `saveLeads` inexistente
   - Melhorado tratamento de fornecedores sem todos os campos

3. **✅ _docusign.js**
   - Corrigido uso de `lead.email` → `lead.contact_email`
   - Garantido compatibilidade com estrutura de dados

4. **✅ _billing.js**
   - Já estava correto, sem alterações necessárias

### 📦 Novos Arquivos

1. **✅ .env.example**
   - Template com todas as variáveis de ambiente necessárias
   - Comentários explicativos para cada variável

2. **✅ .gitignore**
   - Ignora node_modules, .env, logs, etc.
   - Pronto para versionamento Git

3. **✅ DATA_PERSISTENCE.md**
   - Documentação completa sobre limitação de persistência no Netlify
   - Guia de migração para Supabase
   - Exemplos de código prontos para usar

4. **✅ DEPLOY_GUIDE.md** (este arquivo)
   - Instruções passo a passo de deploy

### 🔍 Validações

- ✅ Todas as 27 funções JavaScript validadas (sintaxe OK)
- ✅ Todas as 16 páginas HTML presentes
- ✅ Estrutura de diretórios correta
- ✅ netlify.toml configurado corretamente
- ✅ package.json atualizado com scripts úteis

---

## 📋 PRÉ-REQUISITOS

Antes de fazer deploy, você precisa:

### 1. Conta Netlify
- Acesse https://netlify.com e crie uma conta gratuita

### 2. Chaves de API (Obrigatórias para Funcionalidade Completa)

#### OpenAI (para Brain e Outreach)
- Acesse https://platform.openai.com/api-keys
- Crie uma API key
- Copie e guarde: `sk-proj-...`

#### Stripe (para Billing)
- Acesse https://dashboard.stripe.com/test/apikeys
- Copie a "Secret key" (modo teste): `sk_test_...`
- Para produção, use a chave real: `sk_live_...`

#### DocuSign (para Contratos)
- Acesse https://developers.docusign.com/
- Crie uma conta de desenvolvedor
- Obtenha:
  - Base URL: `https://demo.docusign.net/restapi`
  - Account ID
  - Access Token (via OAuth)

### 3. Git (Opcional, mas Recomendado)
- Instale Git: https://git-scm.com/
- Crie conta no GitHub: https://github.com

---

## 🚀 DEPLOY PASSO A PASSO

### Opção A: Deploy via Netlify UI (Drag & Drop)

#### Passo 1: Preparar o Projeto

```bash
# Se você recebeu um ZIP, extraia primeiro
unzip brokerchain-v26_0-fixed.zip

# Navegue até a pasta
cd brokerchain-fixed
```

#### Passo 2: Deploy Manual

1. Acesse https://app.netlify.com/
2. Faça login
3. Clique em **"Add new site"** → **"Deploy manually"**
4. **Arraste a pasta inteira** `brokerchain-fixed` para a área de drop
5. Aguarde o deploy completar (1-2 minutos)
6. Você receberá uma URL tipo: `https://random-name-123.netlify.app`

#### Passo 3: Configurar Variáveis de Ambiente

1. No painel do site, vá em **Site settings** → **Environment variables**
2. Clique em **"Add a variable"** para cada uma:

**Obrigatórias:**
```
OPENAI_API_KEY = sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY = sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SUCCESS_URL = https://SEU-SITE.netlify.app/dashboard.html
STRIPE_CANCEL_URL = https://SEU-SITE.netlify.app/dashboard.html
DOCUSIGN_BASE_URL = https://demo.docusign.net/restapi
DOCUSIGN_ACCOUNT_ID = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DOCUSIGN_ACCESS_TOKEN = eyJ0eXAiOiJNVCIsImFsZyI6IlJTMjU2...
```

**Opcionais:**
```
DOCUSIGN_TEMPLATE_ID = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EMAIL_IMAP_USER = contact@yourdomain.com
EMAIL_IMAP_PASS = your-password
EMAIL_SMTP_USER = contact@yourdomain.com
EMAIL_SMTP_PASS = your-password
```

3. Substitua `SEU-SITE` pela URL real do seu site
4. Clique em **"Save"**

#### Passo 4: Trigger Deploy

1. Vá em **Deploys**
2. Clique em **"Trigger deploy"** → **"Deploy site"**
3. Aguarde o deploy completar
4. Acesse seu site!

---

### Opção B: Deploy via Git (Recomendado para Produção)

#### Passo 1: Criar Repositório Git

```bash
cd brokerchain-fixed

# Inicializar Git
git init

# Adicionar todos os arquivos
git add .

# Fazer primeiro commit
git commit -m "Initial commit - BrokerChain v26.0"
```

#### Passo 2: Enviar para GitHub

```bash
# Criar repositório no GitHub primeiro (via web)
# Depois conectar:

git remote add origin https://github.com/SEU-USUARIO/brokerchain.git
git branch -M main
git push -u origin main
```

#### Passo 3: Conectar ao Netlify

1. No Netlify, clique em **"Add new site"** → **"Import an existing project"**
2. Escolha **"GitHub"** (ou GitLab/Bitbucket)
3. Autorize o Netlify a acessar seus repositórios
4. Selecione o repositório `brokerchain`
5. Configure:
   - **Branch to deploy**: `main`
   - **Base directory**: (deixe vazio)
   - **Build command**: (deixe vazio ou `echo "static"`)
   - **Publish directory**: `public`
6. Clique em **"Deploy site"**

#### Passo 4: Configurar Variáveis de Ambiente

(Mesmo processo da Opção A, Passo 3)

#### Passo 5: Deploys Automáticos

Agora, sempre que você fizer push para o GitHub:

```bash
git add .
git commit -m "Update feature X"
git push
```

O Netlify fará deploy automaticamente! 🎉

---

### Opção C: Deploy via Netlify CLI (Para Desenvolvedores)

#### Passo 1: Instalar Netlify CLI

```bash
npm install -g netlify-cli
```

#### Passo 2: Login

```bash
netlify login
```

#### Passo 3: Inicializar Site

```bash
cd brokerchain-fixed
netlify init
```

Siga as instruções no terminal.

#### Passo 4: Deploy

```bash
# Deploy de teste
netlify deploy

# Deploy de produção
netlify deploy --prod
```

#### Passo 5: Configurar Variáveis

```bash
# Via CLI
netlify env:set OPENAI_API_KEY "sk-proj-..."
netlify env:set STRIPE_SECRET_KEY "sk_test_..."
# ... etc

# Ou via web interface (mais fácil)
netlify open:admin
```

---

## ✅ VERIFICAÇÃO PÓS-DEPLOY

### 1. Testar Landing Page

Acesse: `https://seu-site.netlify.app/`

**Deve mostrar:**
- ✅ Título "BrokerChain"
- ✅ 4 blocos de serviços (Emergency, Federal, Solar, B2B)
- ✅ Link para "Internal Dashboard"

### 2. Testar Dashboard

Acesse: `https://seu-site.netlify.app/dashboard.html`

**Deve mostrar:**
- ✅ Painel de controle com toggles
- ✅ Botões de execução manual
- ✅ Tabela de leads (vazia inicialmente)

### 3. Testar API Marketplace

Acesse: `https://seu-site.netlify.app/api/marketplace`

**Deve retornar JSON:**
```json
{
  "ok": true,
  "leads": []
}
```

### 4. Testar Geração de Leads (Manual)

1. No dashboard, clique em **"Scrape Buyers USA"**
2. Aguarde alguns segundos
3. A tabela deve mostrar leads gerados
4. ⚠️ **IMPORTANTE**: Esses leads serão perdidos no próximo deploy (ver DATA_PERSISTENCE.md)

### 5. Verificar Deploy Log

1. No Netlify, vá em **Deploys** → último deploy
2. Clique em **"Deploy log"**
3. Procure por erros (linhas em vermelho)
4. Status deve ser **"Published"**

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: "Page Not Found" na Landing Page

**Causa**: Publish directory incorreto

**Solução**:
1. Site settings → Build & deploy → Build settings
2. Configure **Publish directory**: `public`
3. Save e Trigger deploy

### Problema 2: Funções Retornam 500 Error

**Causa**: Variáveis de ambiente não configuradas

**Solução**:
1. Verifique se todas as variáveis obrigatórias estão configuradas
2. Verifique se não há espaços extras nos valores
3. Trigger deploy após adicionar variáveis

### Problema 3: Dashboard Não Carrega Dados

**Causa**: Redirect não funcionando

**Solução**:
1. Verifique se `netlify.toml` está na raiz do projeto
2. Teste acessando diretamente: `/.netlify/functions/marketplace`
3. Se retornar JSON, o redirect está OK

### Problema 4: Leads Desaparecem Após Deploy

**Causa**: Dados não persistem no Netlify (comportamento esperado)

**Solução**:
- Leia `DATA_PERSISTENCE.md`
- Migre para Supabase ou Firebase
- Isso é **normal** para a versão atual

### Problema 5: Cron Jobs Não Executam

**Causa**: Scheduled functions só funcionam no plano Pro

**Solução**:
- Use botões manuais no dashboard (plano gratuito)
- Ou faça upgrade para Netlify Pro ($19/mês)

---

## 📊 LIMITES DO PLANO GRATUITO NETLIFY

| Recurso | Limite Gratuito | Observação |
|---------|-----------------|------------|
| Bandwidth | 100 GB/mês | Suficiente para começar |
| Build minutes | 300 min/mês | Mais que suficiente (site estático) |
| Function invocations | 125k/mês | ~4k por dia |
| Function runtime | 100 horas/mês | Suficiente para MVP |
| Concurrent builds | 1 | Um deploy por vez |
| Scheduled functions | ❌ Não | Só no plano Pro |

**Recomendação**: Comece no gratuito, faça upgrade quando necessário.

---

## 🎯 PRÓXIMOS PASSOS APÓS DEPLOY

### Curto Prazo (Esta Semana)

1. **✅ Testar Todas as Páginas**
   - Landing, Dashboard, Marketplace, etc.
   - Verificar se tudo carrega corretamente

2. **✅ Gerar Dados de Teste**
   - Clicar em "Scrape Buyers USA"
   - Clicar em "Scrape Suppliers USA"
   - Clicar em "Qualificar (Brain)"
   - Verificar se aparecem na tabela

3. **✅ Testar Stripe (Modo Teste)**
   - Usar cartão de teste: `4242 4242 4242 4242`
   - Verificar se checkout abre
   - Verificar se transação aparece no Stripe Dashboard

4. **✅ Configurar Custom Domain (Opcional)**
   - Site settings → Domain management
   - Add custom domain
   - Configurar DNS conforme instruções

### Médio Prazo (Este Mês)

1. **🔄 Migrar para Supabase**
   - Seguir guia em `DATA_PERSISTENCE.md`
   - Criar tabelas no Supabase
   - Atualizar funções para usar banco de dados
   - Testar persistência real

2. **🔄 Configurar DocuSign Templates**
   - Criar templates no DocuSign
   - Configurar campos personalizados
   - Testar envio de envelopes

3. **🔄 Adicionar Leads Reais**
   - Usar botão "Adicionar Lead Manual"
   - Ou integrar com fontes reais de dados
   - Testar fluxo completo (lead → dispatch → pagamento)

4. **🔄 Configurar Webhooks Stripe**
   - Para receber confirmações de pagamento
   - Atualizar status de leads automaticamente

### Longo Prazo (Próximos Meses)

1. **📈 Escalar Operação**
   - Adicionar mais fornecedores
   - Expandir para mais estados/categorias
   - Automatizar outreach

2. **📈 Melhorar Analytics**
   - Integrar Google Analytics
   - Criar dashboard de métricas
   - Monitorar conversões

3. **📈 Otimizar Performance**
   - Adicionar caching
   - Otimizar queries de banco
   - Implementar CDN para assets

4. **📈 Adicionar Features**
   - Sistema de notificações (email/SMS)
   - Chat/messaging para fornecedores
   - App mobile (PWA)

---

## 📞 SUPORTE

### Documentação Oficial

- **Netlify**: https://docs.netlify.com/
- **Stripe**: https://stripe.com/docs
- **DocuSign**: https://developers.docusign.com/
- **Supabase**: https://supabase.com/docs

### Arquivos de Referência

- `DATA_PERSISTENCE.md` - Guia de migração para banco de dados
- `.env.example` - Template de variáveis de ambiente
- `README.md` - Documentação original do projeto

### Troubleshooting

Se encontrar problemas:

1. **Verifique o Deploy Log** no Netlify
2. **Teste localmente** com `netlify dev`
3. **Verifique variáveis de ambiente** estão corretas
4. **Consulte a documentação** relevante

---

## ✨ DICAS EXTRAS

### Performance

- Use Netlify Analytics ($9/mês) para métricas detalhadas
- Ou Google Analytics (gratuito) para básico
- Monitore uso de functions para evitar estourar limites

### Segurança

- **NUNCA** commite `.env` no Git (já está no `.gitignore`)
- Use secrets do Netlify para variáveis sensíveis
- Ative HTTPS (automático no Netlify)
- Configure CORS adequadamente (já configurado)

### SEO

- Adicione meta tags nas páginas HTML
- Configure sitemap.xml
- Use Netlify Forms para captura de leads via site

### Backup

- Faça backup regular do banco de dados (Supabase tem backup automático)
- Mantenha cópia local do código
- Use Git para versionamento

---

## 🎉 CONCLUSÃO

Você agora tem um projeto **BrokerChain v26.0** totalmente corrigido e pronto para deploy no Netlify!

**Principais Melhorias:**
- ✅ Todas as funções corrigidas e validadas
- ✅ Documentação completa de deploy
- ✅ Guia de migração para persistência real
- ✅ Scripts úteis no package.json
- ✅ Variáveis de ambiente documentadas

**Próximo Passo Crítico:**
- 🔄 Migrar para Supabase (ver `DATA_PERSISTENCE.md`)

**Boa sorte com seu deploy! 🚀**

---

*BrokerChain v26.0 - Emergency Sourcing & Rapid Dispatch*
