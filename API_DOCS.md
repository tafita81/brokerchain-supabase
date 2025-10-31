# API Documentation - BrokerChain Supabase

## Overview

BrokerChain é uma plataforma de despacho emergencial e sourcing que conecta compradores a fornecedores em tempo real. Esta documentação descreve os endpoints disponíveis na API.

**Base URL:** `https://your-site.netlify.app/api`

**Ambiente de desenvolvimento:** As funções Netlify rodam em `/.netlify/functions/`

---

## Autenticação

A maioria dos endpoints administrativos requer autenticação JWT.

### POST /auth/login

Autentica um usuário e retorna um token JWT.

**Request Body:**
```json
{
  "email": "admin@brokerchain.com",
  "password": "senha-segura"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin-1",
    "email": "admin@brokerchain.com",
    "role": "admin"
  },
  "expiresIn": "24h"
}
```

**Headers para rotas protegidas:**
```
Authorization: Bearer <token>
```

---

## Leads

### GET /leads-all

Lista todos os leads no sistema.

**Query Parameters:**
- `status` (optional): Filtrar por status (scraped, qualified, dispatched, contacted, converted, lost)
- `sale_ready` (optional): Filtrar por sale_ready (true/false)
- `tenant` (optional): Filtrar por tenant

**Response (200):**
```json
[
  {
    "id": "lead-abc123-xyz",
    "title": "Emergency HVAC repair needed",
    "body": "Data center AC failed, need immediate repair",
    "contact_email": "buyer@example.com",
    "contact_phone": "+1234567890",
    "state": "TX",
    "buyer_type": "private",
    "urgency": "1-2h",
    "category": "hvac",
    "tenant": "emergency-dispatch-exchange",
    "status": "scraped",
    "created_utc": "2025-10-31T00:00:00.000Z"
  }
]
```

### GET /leads?id=<lead_id>

Obtém detalhes de um lead específico.

**Query Parameters:**
- `id` (required): ID do lead

**Response (200):**
```json
{
  "id": "lead-abc123-xyz",
  "title": "Emergency HVAC repair needed",
  "body": "Data center AC failed, need immediate repair",
  "contact_email": "buyer@example.com",
  "state": "TX",
  "status": "qualified"
}
```

### POST /manual-lead

Cria um lead manualmente (requer autenticação).

**Request Body:**
```json
{
  "title": "Need emergency plumbing",
  "body": "Pipe burst in commercial building",
  "contact_email": "manager@building.com",
  "contact_phone": "+1234567890",
  "state": "CA",
  "buyer_type": "commercial",
  "urgency": "today",
  "category": "plumbing",
  "tenant": "emergency-dispatch-exchange"
}
```

**Response (200):**
```json
{
  "ok": true,
  "lead": {
    "id": "lead-xyz789-abc",
    "title": "Need emergency plumbing",
    "status": "scraped",
    "created_utc": "2025-10-31T00:00:00.000Z"
  }
}
```

---

## Suppliers

### GET /suppliers

Lista todos os fornecedores ativos.

**Query Parameters:**
- `state` (optional): Filtrar por estado
- `active` (optional): Filtrar por status ativo (true/false)

**Response (200):**
```json
[
  {
    "id": "supplier-abc123",
    "name": "Emergency HVAC Services TX",
    "email": "contact@hvacemergency.com",
    "phone": "+1234567890",
    "state": "TX",
    "states_served": ["TX", "OK", "LA"],
    "categories": ["hvac", "emergency-repair"],
    "active": true,
    "rating": 4.8
  }
]
```

### POST /register-supplier

Registra um novo fornecedor.

**Request Body:**
```json
{
  "name": "ABC Emergency Services",
  "email": "contact@abc.com",
  "phone": "+1234567890",
  "state": "NY",
  "states_served": ["NY", "NJ", "CT"],
  "categories": ["water-mitigation", "roofing", "hvac"]
}
```

**Response (200):**
```json
{
  "ok": true,
  "supplier": {
    "id": "supplier-xyz789",
    "name": "ABC Emergency Services",
    "active": true
  }
}
```

---

## Dispatch

### POST /dispatch

Executa o despacho automático de leads para suppliers (requer autenticação).

**Request Body:**
```json
{
  "dryRun": false
}
```

**Response (200):**
```json
{
  "ok": true,
  "processed": 15,
  "dispatched": 12,
  "skipped": 3,
  "results": [
    {
      "leadId": "lead-abc123",
      "status": "dispatched",
      "supplier": "supplier-xyz789"
    }
  ]
}
```

---

## Automation

### POST /scrape-leads

Executa scraping de novos leads (normalmente executado via cron).

**Response (200):**
```json
{
  "ok": true,
  "scrapedCount": 25,
  "newLeads": 18,
  "duplicates": 7
}
```

### POST /crawl-run

Executa o crawler para buscar leads (cron job).

**Response (200):**
```json
{
  "ok": true,
  "crawled": 50,
  "added": 30
}
```

### POST /supplier-outreach-run

Executa outreach automático para suppliers (cron job).

**Response (200):**
```json
{
  "ok": true,
  "sentEmails": 15
}
```

---

## Brain (AI Processing)

### POST /brain

Processa um lead usando AI para qualificação e insights (requer autenticação).

**Request Body:**
```json
{
  "leadId": "lead-abc123-xyz"
}
```

**Response (200):**
```json
{
  "ok": true,
  "result": {
    "qualified": true,
    "category": "hvac",
    "urgency": "1-2h",
    "confidence": 0.95,
    "reasoning": "Clear emergency situation with immediate need",
    "estimated_value": "high",
    "key_requirements": ["24/7 availability", "commercial HVAC expertise"]
  }
}
```

---

## Buyers

### GET /buyers-all

Lista todos os compradores registrados.

**Response (200):**
```json
[
  {
    "id": "buyer-abc123",
    "dedupe_key": "buyer@example.com",
    "contact_email": "buyer@example.com",
    "contact_phone": "+1234567890",
    "states": {
      "TX": true,
      "CA": true
    },
    "intents": {
      "emergency-dispatch-exchange": true
    },
    "authorized_under_15k": true,
    "buyer_type": "public",
    "last_seen_utc": "2025-10-31T00:00:00.000Z"
  }
]
```

---

## Settings

### GET /settings

Obtém configurações do sistema.

**Response (200):**
```json
{
  "dispatch_auto_enabled": true,
  "scraping_interval_minutes": 10,
  "min_lead_score": 0.7
}
```

### POST /settings

Atualiza uma configuração (requer autenticação).

**Request Body:**
```json
{
  "key": "dispatch_auto_enabled",
  "value": true
}
```

**Response (200):**
```json
{
  "ok": true,
  "key": "dispatch_auto_enabled",
  "value": true
}
```

---

## Monitoring

### GET /setup-health

Verifica a saúde do sistema e configurações.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T00:00:00.000Z",
  "checks": {
    "supabase": {
      "status": "healthy",
      "message": "Connected"
    },
    "environment": {
      "status": "healthy",
      "message": "All required environment variables are set"
    },
    "memory": {
      "status": "healthy",
      "usage": {
        "heapUsed": 45
      },
      "message": "Heap used: 45MB"
    },
    "errorRate": {
      "status": "healthy",
      "rate": "1.20%",
      "message": "5 errors out of 420 requests"
    }
  }
}
```

### GET /metrics

Obtém métricas do sistema (requer autenticação).

**Response (200):**
```json
{
  "requests": {
    "total": 1250,
    "success": 1180,
    "errors": 70,
    "byEndpoint": {
      "/leads-all": {
        "total": 250,
        "success": 245,
        "errors": 5
      }
    }
  },
  "leads": {
    "scraped": 450,
    "qualified": 380,
    "dispatched": 320,
    "converted": 85
  },
  "performance": {
    "averageResponseTime": 145
  },
  "uptime": {
    "hours": 72,
    "seconds": 259200
  }
}
```

---

## Billing

### POST /create-checkout

Cria uma sessão de checkout Stripe para pagamento.

**Request Body:**
```json
{
  "leadId": "lead-abc123",
  "amount": 150,
  "description": "Emergency dispatch fee"
}
```

**Response (200):**
```json
{
  "ok": true,
  "checkout_url": "https://checkout.stripe.com/pay/cs_test_...",
  "session_id": "cs_test_..."
}
```

---

## DocuSign

### POST /create-envelope

Cria um envelope DocuSign para assinatura.

**Request Body:**
```json
{
  "leadId": "lead-abc123"
}
```

**Response (200):**
```json
{
  "ok": true,
  "envelopeId": "abc-123-xyz-789"
}
```

---

## Error Responses

Todos os endpoints podem retornar os seguintes erros:

### 400 Bad Request
```json
{
  "error": "Validation error",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "message": "must be a valid email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Please provide a valid JWT token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later."
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An error occurred"
}
```

---

## Rate Limiting

- **Geral:** 100 requisições por 15 minutos
- **Autenticação:** 5 tentativas por 15 minutos
- **Criação (POST):** 10 requisições por minuto

Os headers de resposta incluem:
- `X-RateLimit-Limit`: Limite total
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Timestamp do reset

---

## CORS

Origens permitidas são configuradas via variável de ambiente `ALLOWED_ORIGINS`.

Por padrão, as seguintes origens são permitidas em desenvolvimento:
- `http://localhost:3000`
- `http://localhost:8080`
- `https://brokerchain.netlify.app`

---

## Webhooks

### Stripe Webhook

Endpoint: `/webhooks/stripe`

Eventos suportados:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.failed`

### DocuSign Webhook

Endpoint: `/webhooks/docusign`

Eventos suportados:
- `envelope-completed`
- `envelope-declined`
- `recipient-signed`

---

## Notas de Segurança

1. **Sempre use HTTPS em produção**
2. **Tokens JWT expiram em 24 horas**
3. **Senhas devem ter no mínimo 8 caracteres**
4. **API keys nunca devem ser expostas no frontend**
5. **Use variáveis de ambiente para todas as credenciais**
6. **Implemente rate limiting adequado em produção**

---

## Suporte

Para questões ou suporte, entre em contato através de:
- GitHub Issues: https://github.com/tafita81/brokerchain-supabase/issues
- Email: support@brokerchain.com
