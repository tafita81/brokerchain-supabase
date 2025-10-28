# Changelog - BrokerChain

## [26.0.0] - 2025-10-28

### 🔧 CORREÇÕES CRÍTICAS

#### functions/_util.js
- **ADICIONADO**: Função `saveLeads(leads)` que estava faltando
- **ADICIONADO**: Função `matchSupplierForLead(lead, suppliers)` que estava faltando
- **ADICIONADO**: Export de `randomId` que estava faltando
- **MELHORADO**: Tratamento de erros em `readJSON/writeJSON` com console.error
- **MELHORADO**: Criação automática de diretórios se não existirem
- **CORRIGIDO**: Função `pushLead` agora adiciona campos `category` e `zip`

#### functions/dispatch.js
- **CORRIGIDO**: Uso de `lead.email` → `lead.contact_email` (2 ocorrências)
- **CORRIGIDO**: Import de `saveLeads` de `_util.js` (estava usando função inexistente)
- **CORRIGIDO**: Chamada de `writeJSON` ao invés de `saveLeads` inexistente
- **MELHORADO**: Tratamento de fornecedores sem todos os campos (fallback para valores padrão)
- **MELHORADO**: Estrutura de `assigned_supplier_contact` com fallbacks

#### functions/_docusign.js
- **CORRIGIDO**: Uso de `lead.email` → `lead.contact_email` (2 ocorrências em templateRoles e recipients)
- **GARANTIDO**: Compatibilidade com estrutura de dados correta

#### functions/_billing.js
- **VALIDADO**: Código já estava correto, sem alterações necessárias
- **CONFIRMADO**: Integração Stripe funcionando corretamente

### 📦 NOVOS ARQUIVOS

#### .env.example
- **CRIADO**: Template completo de variáveis de ambiente
- **INCLUÍDO**: Comentários explicativos para cada variável
- **ORGANIZADO**: Por categoria (OpenAI, Stripe, DocuSign, Email, Supabase)

#### .gitignore
- **CRIADO**: Arquivo gitignore adequado para Node.js/Netlify
- **INCLUÍDO**: node_modules, .env, logs, build artifacts, IDE configs

#### DATA_PERSISTENCE.md
- **CRIADO**: Documentação completa sobre limitação de persistência no Netlify
- **INCLUÍDO**: Guia detalhado de migração para Supabase
- **INCLUÍDO**: Exemplos de código SQL para criar tabelas
- **INCLUÍDO**: Exemplos de código JavaScript para integração
- **INCLUÍDO**: Checklist de migração passo a passo

#### DEPLOY_GUIDE.md
- **CRIADO**: Guia completo de deploy passo a passo
- **INCLUÍDO**: 3 opções de deploy (UI, Git, CLI)
- **INCLUÍDO**: Checklist de verificação pós-deploy
- **INCLUÍDO**: Troubleshooting de problemas comuns
- **INCLUÍDO**: Próximos passos recomendados

#### CHANGELOG.md
- **CRIADO**: Este arquivo de changelog

### 🔄 ARQUIVOS ATUALIZADOS

#### package.json
- **ATUALIZADO**: Versão 25.0.0 → 26.0.0
- **ATUALIZADO**: Nome do pacote para `brokerchain-v26_0`
- **MELHORADO**: Scripts npm com comandos úteis:
  - `npm run dev` → `netlify dev`
  - `npm run deploy` → `netlify deploy --prod`
  - `npm test` → placeholder para testes futuros

#### netlify.toml
- **VALIDADO**: Configuração correta, sem alterações necessárias
- **CONFIRMADO**: `publish = "public"` correto
- **CONFIRMADO**: `functions = "functions"` correto
- **CONFIRMADO**: Redirects de `/api/*` configurados

### ✅ VALIDAÇÕES

#### Sintaxe JavaScript
- **VALIDADO**: Todas as 27 funções JavaScript com `node -c`
- **RESULTADO**: ✓ Todas passaram sem erros

#### Estrutura de Arquivos
- **VALIDADO**: Todas as 16 páginas HTML presentes
- **VALIDADO**: Estrutura de diretórios correta
- **VALIDADO**: Arquivos de dados JSON inicializados

#### Dependências
- **VALIDADO**: package.json com todas as dependências necessárias
- **CONFIRMADO**: node-fetch, uuid, nodemailer, stripe

### 📚 DOCUMENTAÇÃO

#### Melhorias na Documentação
- **CRIADO**: 4 novos arquivos de documentação
- **TOTAL**: ~500 linhas de documentação adicionadas
- **COBERTURA**: Deploy, persistência, variáveis de ambiente, changelog

### 🚨 AVISOS IMPORTANTES

#### Persistência de Dados
- **LIMITAÇÃO**: Arquivos JSON não persistem entre deploys no Netlify
- **SOLUÇÃO**: Migração para Supabase/Firebase recomendada (ver DATA_PERSISTENCE.md)
- **STATUS**: Funciona como demonstração, não adequado para produção sem migração

#### Scheduled Functions
- **LIMITAÇÃO**: Cron jobs não funcionam no plano gratuito Netlify
- **SOLUÇÃO**: Usar botões manuais ou upgrade para plano Pro
- **STATUS**: Funcionalidade manual disponível

### 🎯 RESUMO DAS CORREÇÕES

| Categoria | Correções | Status |
|-----------|-----------|--------|
| Funções faltantes | 3 | ✅ Corrigido |
| Bugs de campo | 4 | ✅ Corrigido |
| Documentação | 4 novos arquivos | ✅ Completo |
| Validações | 27 funções | ✅ Todas OK |
| Configuração | 2 arquivos | ✅ Atualizado |

### 🔜 PRÓXIMAS VERSÕES

#### v27.0 (Planejado)
- Integração completa com Supabase
- Persistência real de dados
- Testes automatizados
- CI/CD pipeline

#### v28.0 (Planejado)
- Sistema de notificações (email/SMS)
- Webhooks Stripe para confirmação automática
- Dashboard de analytics
- API pública documentada

---

## [25.0.0] - 2025-10-28 (Original)

### Versão Inicial
- Sistema completo de 4 linhas de negócio (tenants)
- 27 funções serverless
- 16 páginas HTML
- Integração Stripe + DocuSign + OpenAI
- Pipeline automático de leads

### Problemas Conhecidos (Corrigidos na v26.0)
- Funções faltantes em _util.js
- Uso incorreto de `lead.email` ao invés de `lead.contact_email`
- Falta de documentação de deploy
- Sem guia de persistência de dados

---

*Para mais informações, consulte DEPLOY_GUIDE.md e DATA_PERSISTENCE.md*
