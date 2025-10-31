# Contributing to BrokerChain Supabase

Obrigado por considerar contribuir para o BrokerChain! Este documento fornece diretrizes para contribuir com o projeto.

## Código de Conduta

- Seja respeitoso e profissional
- Aceite críticas construtivas
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros da comunidade

## Como Contribuir

### Reportando Bugs

Se você encontrou um bug:

1. **Verifique** se o bug já foi reportado nas [Issues](https://github.com/tafita81/brokerchain-supabase/issues)
2. **Crie uma nova issue** com:
   - Título claro e descritivo
   - Descrição detalhada do problema
   - Passos para reproduzir
   - Comportamento esperado vs. atual
   - Screenshots (se aplicável)
   - Informações do ambiente (Node version, OS, etc.)

### Sugerindo Melhorias

Para sugerir novas funcionalidades:

1. **Abra uma Issue** com o tag `enhancement`
2. **Descreva** claramente a funcionalidade
3. **Explique** por que seria útil
4. **Inclua** exemplos de uso, se possível

### Pull Requests

#### Antes de Submeter

1. Certifique-se de que o código segue o style guide
2. Adicione testes para novas funcionalidades
3. Atualize a documentação
4. Execute todos os testes
5. Execute o linter

#### Processo de PR

1. **Fork** o repositório
2. **Crie** uma branch para sua feature: `git checkout -b feature/minha-feature`
3. **Commit** suas mudanças: `git commit -m 'Add: minha feature'`
4. **Push** para a branch: `git push origin feature/minha-feature`
5. **Abra** um Pull Request

#### Convenções de Commit

Use mensagens de commit claras e descritivas:

```
Add: Nova funcionalidade
Fix: Correção de bug
Update: Atualização de funcionalidade existente
Docs: Mudanças na documentação
Style: Formatação, ponto e vírgula faltando, etc
Refactor: Refatoração de código
Test: Adição de testes
Chore: Tarefas de manutenção
```

Exemplos:
```
Add: JWT authentication system
Fix: Rate limiting not working on /api/leads
Update: Improve AI processing with GPT-4o-mini
Docs: Add API documentation for suppliers endpoint
```

## Configuração do Ambiente de Desenvolvimento

### Requisitos

- Node.js >= 18.0.0
- npm ou yarn
- Conta Supabase (para desenvolvimento)
- Git

### Setup

1. **Clone o repositório:**
```bash
git clone https://github.com/tafita81/brokerchain-supabase.git
cd brokerchain-supabase
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
# Edite .env com suas credenciais
```

4. **Configure o Supabase:**
   - Crie uma conta em [supabase.com](https://supabase.com)
   - Crie um novo projeto
   - Execute o schema SQL em `supabase-schema.sql`
   - Copie as credenciais para o `.env`

5. **Verifique a instalação:**
```bash
npm run lint
npm test
```

## Estrutura do Projeto

```
brokerchain-supabase/
├── functions/           # Netlify Functions (API endpoints)
│   ├── _*.js           # Módulos compartilhados (prefixo _)
│   ├── *.js            # Endpoints individuais
│   └── tests/          # Testes
├── public/             # Frontend estático
├── data/               # Arquivos JSON (deprecated, migrando para Supabase)
├── docs/               # Documentação adicional
├── .env.example        # Template de variáveis de ambiente
├── package.json        # Dependências e scripts
├── netlify.toml        # Configuração Netlify
└── README.md           # Documentação principal
```

## Style Guide

### JavaScript

Seguimos o [ESLint](https://eslint.org/) e [Prettier](https://prettier.io/) configurados no projeto.

**Principais regras:**

- Use `const` e `let`, nunca `var`
- Use arrow functions quando apropriado
- Use template literals para strings
- Use destructuring quando possível
- Sempre use ponto e vírgula
- Indentação: 2 espaços
- Aspas simples para strings
- Linha máxima: 100 caracteres

**Exemplo:**

```javascript
// ✅ Bom
const getUserData = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    logError('Failed to get user', error);
    return null;
  }

  return data;
};

// ❌ Ruim
var getUserData = function(userId) {
    var data = supabase.from('users').select('*').eq('id', userId).single()
    return data
}
```

### Naming Conventions

- **Variáveis e funções:** camelCase (`getUserData`, `isActive`)
- **Constantes:** UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_BASE_URL`)
- **Classes:** PascalCase (`AICore`, `LeadProcessor`)
- **Arquivos:** kebab-case (`_ai-core.js`, `lead-processor.js`)
- **Private/Internal:** prefixo `_` (`_logger.js`, `_validateInput`)

### Comentários

- Use comentários para explicar **por que**, não **o que**
- Documente funções públicas com JSDoc
- Mantenha comentários atualizados

**Exemplo:**

```javascript
/**
 * Processa um lead usando AI para qualificação
 * @param {Object} leadData - Dados do lead
 * @param {string} leadData.title - Título do lead
 * @param {string} leadData.body - Descrição
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processLead(leadData) {
  // Usar temperatura baixa para respostas mais consistentes
  const temperature = 0.3;
  
  // ...
}
```

## Testes

### Executando Testes

```bash
# Todos os testes
npm test

# Watch mode
npm run test:watch

# Com coverage
npm run test:coverage
```

### Escrevendo Testes

- Um arquivo de teste por módulo: `module.test.js`
- Use describe/it para organizar testes
- Teste casos de sucesso e erro
- Use mocks para APIs externas
- Mantenha testes isolados e independentes

**Exemplo:**

```javascript
const { validateLead } = require('./_validation');

describe('Lead Validation', () => {
  it('should validate a valid lead', () => {
    const lead = {
      title: 'Emergency HVAC repair',
      contact_email: 'test@example.com',
      state: 'TX',
      buyer_type: 'private',
    };

    const { error, value } = validateLead(lead);
    
    expect(error).toBeUndefined();
    expect(value).toBeDefined();
  });

  it('should reject lead without contact info', () => {
    const lead = {
      title: 'Emergency HVAC repair',
      state: 'TX',
    };

    const { error } = validateLead(lead);
    
    expect(error).toBeDefined();
  });
});
```

## Logging

Use o módulo `_logger.js` para todos os logs:

```javascript
const { logInfo, logError, logWarn } = require('./_logger');

// Info
logInfo('Lead processed successfully', { leadId: 'lead-123' });

// Error
logError('Failed to process lead', error, { leadId: 'lead-123' });

// Warning
logWarn('Rate limit approaching', { current: 95, max: 100 });
```

## Segurança

### Boas Práticas

1. **Nunca** commite credenciais ou secrets
2. **Sempre** valide entrada do usuário
3. **Use** prepared statements para queries
4. **Implemente** rate limiting em endpoints públicos
5. **Sanitize** dados antes de enviar para APIs externas
6. **Use** HTTPS em produção
7. **Valide** tokens JWT em rotas protegidas

### Vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança:

1. **NÃO** abra uma issue pública
2. **Envie** um email para: security@brokerchain.com
3. **Inclua** detalhes técnicos e passos para reproduzir
4. **Aguarde** resposta antes de disclosure público

## Documentação

### Atualizando Documentação

Ao adicionar ou modificar funcionalidades:

1. Atualize o `README.md` se necessário
2. Atualize `API_DOCS.md` para novos endpoints
3. Adicione JSDoc comments em funções públicas
4. Atualize o `CHANGELOG.md`

### Escrevendo Boa Documentação

- Seja claro e conciso
- Use exemplos práticos
- Inclua casos de uso comuns
- Mantenha consistência de formatação
- Use markdown apropriadamente

## Code Review

Ao revisar PRs:

- Seja construtivo e respeitoso
- Verifique se segue o style guide
- Teste as mudanças localmente
- Verifique se há testes adequados
- Valide a documentação
- Verifique implicações de segurança

## Recursos Adicionais

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Supabase Documentation](https://supabase.com/docs)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

## Perguntas?

Se você tiver dúvidas:

1. Verifique a [documentação](./README.md)
2. Procure em [Issues existentes](https://github.com/tafita81/brokerchain-supabase/issues)
3. Abra uma nova Issue com o tag `question`
4. Entre em contato: dev@brokerchain.com

---

**Obrigado por contribuir para o BrokerChain! 🚀**
