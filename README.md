# BrokerChain v20.0

Central de despacho / sourcing que roda 24/7 na Netlify Functions (grátis / serverless), faz scraping nacional dos EUA (50 estados + DC), cruza comprador desesperado com fornecedor de plantão, e fecha dinheiro via Stripe + DocuSign — supervisionado por você no iPhone.

Agora com quatro linhas comerciais (“tenants”):
1. **emergency-dispatch-exchange**
   - Emergência privada/comercial/residencial.
   - Telhado destruído (hail damage), inundação precisando bomba, HVAC crítico parado em clínica/data center, gerador diesel pra abrigo.
   - Urgência: "1-2h" / "today".
   - Monetização: Stripe taxa de mobilização + DocuSign autorização de serviço.

2. **federal-micro-purchase-fastlane**
   - Setor público / infraestrutura crítica (county, city utility, shelter).
   - Compras emergenciais até ~15k USD, autorizadas em cartão institucional (micro-purchase). Isso pode ser aprovado sem licitação longa, então eles podem literalmente pagar já.
   - Ex.: "preciso de 3 bombas de água portáteis até amanhã, authorized under micro-purchase threshold".
   - Fluxo: valida se `authorized_under_15k === true`.
     - Se sim: DocuSign primeiro (formaliza autorização), Stripe depois (captura).
     - Se não: lead fica `awaiting-authorization` e gera alerta, sem travar a pipeline.

3. **solar-home-us**
   - Dono de casa / pequeno negócio que quer painel solar + bateria AGORA porque ouviu que o crédito fiscal federal (~30%) está acabando / reduzindo.
   - Urgência: "today".
   - Valor do lead: altíssimo, contrato solar+bateria vale dezenas de milhares de dólares e instaladores pagam caro pelo lead quente.
   - Fluxo: Stripe primeiro (taxa de visita / survey), DocuSign depois.

4. **global-sourcing-b2b**
   - Fábricas, plantas de utilidades, infra crítica pedindo suprimento industrial, EPI em lote, kits de contenção de vazamento, peças MRO críticas, selos de bomba, etc.
   - Mensagem típica: "We need 200 chemical-resistant gloves, spill kits, and 2 pump seals. Delivery this week. PO or card is fine."
   - Urgência: "this-week".
   - Isso não é 'socorro em 2h', mas é ticket alto e recorrente B2B. Você vira o "sourcing desk" que resolve sem burocracia.
   - Fluxo: tratado como privado/comercial (Stripe -> DocuSign).
   - Você lucra cobrando taxa de mobilização / brokerage e adicionando margem.

---

## Pipeline automático

### 1. /api/scrape-leads  (cron 10 min + botão "Scrape Buyers USA")
- Gera compradores em TODOS os 50 estados + DC, para os quatro tenants acima.
- Exemplo público (federal-micro-purchase-fastlane):
  "City utility in FL needs 3 portable flood pumps. Under $15k total. Authorized to card immediately."
  - buyer_type: "public"
  - authorized_under_15k: true
  - urgency: "today"
  - category: "water-mitigation"
  - tenant: "federal-micro-purchase-fastlane"

- Exemplo emergência privada (emergency-dispatch-exchange):
  "HVAC shutdown in data/medical facility in TX. Need 24/7 technician ASAP."
  - buyer_type: "private"
  - urgency: "1-2h"
  - category: "hvac-failure"
  - tenant: "emergency-dispatch-exchange"

- Exemplo solar (solar-home-us):
  "Homeowner / small commercial in CA wants rooftop solar + backup battery... wants quote THIS WEEK before credit ends."
  - buyer_type: "private"
  - urgency: "today"
  - category: "solar-install"
  - tenant: "solar-home-us"

- Exemplo industrial B2B (global-sourcing-b2b):
  "Industrial facility in OH needs 200 chemical-resistant gloves, spill kits, and pump seals. Delivery this week, can pay via PO or card."
  - buyer_type: "private-enterprise"
  - urgency: "this-week"
  - category: "industrial-supply"
  - tenant: "global-sourcing-b2b"

Cada lead é salvo em `data/leads.json` com:
- `status:"scraped"`
- `sale_ready:false`
- `authorized_under_15k` (true/false/"unknown")
- timestamps

### 2. /api/scrape-suppliers  (cron 1h + botão "Scrape Suppliers USA")
- Gera fornecedores standby em TODOS os 50 estados + DC.
- Inclui agora também:
  - "Industrial MRO & Safety Supply Desk" com categorias ["industrial-supply","ppe-bulk","mro-parts"] para global-sourcing-b2b.
  - "Solar Install & Battery Backup Fast Close" para solar-home-us.
  - além de roof-emergency, pump-out/flood, HVAC critical, generator rental.
- Salva tudo em `data/suppliers.json`.

### 3. /api/email-inbox  (cron 5 min + botão "Inbox → Lead")
- Converte e-mails reais recebidos em `contact@blokerchain.business` em leads.
- Detecta frases tipo "authorized to card", "under $15k", etc., para marcar `authorized_under_15k` nos leads públicos (micro-purchase).

### 4. /api/brain  (cron 5 min + botão "Qualificar (Brain)")
- Lê `leads.json`.
- Gera `ai_missing_questions[]` para cada lead:
  - "Please confirm ZIP code..."
  - "Are you authorized to approve under the micro-purchase threshold (~15k USD) on card right now?"
  - "Can you pay via PO or corporate card for delivery this week?"
  - "Are you ready to schedule site survey this week?" (solar)
- Decide se `sale_ready:true` e `status:"new"`:
  - Se `urgency` é "1-2h" ou "today": vende agora.
  - Se `tenant === "global-sourcing-b2b"` e `urgency === "this-week"`: também promove agora (porque ticket B2B alto e recorrente).
- Atualiza `leads.json`.

### 5. /api/dispatch  (cron 5 min + botão "Despachar")
- Só roda se `AUTO_DISPATCH_ENABLED===true` em `data/settings.json`.
- Para cada lead `sale_ready:true` + `status:"new"`:
  1. Faz match fornecedor ↔ estado ↔ categoria usando `matchSupplierForLead` (`_util.js`).
     - Se não achar fornecedor: marca `alert_pending:true`, `alert_reason:"no_supplier_available"` e NÃO trava o resto.
  2. Para tenant público `federal-micro-purchase-fastlane`:
     - Exige `authorized_under_15k === true`.
     - Se faltar, marca `status:"awaiting-authorization"`, gera alerta e pula cobrança.
     - Se confirmado:
       - Cria envelope DocuSign primeiro (autoridade formal).
       - Depois cria sessão Stripe (taxa / mobilização / sourcing fee).
  3. Para tenants privados/comerciais/solar/b2b:
       - Stripe primeiro (checkout_url e session_id armazenados no lead).
       - Depois DocuSign (autorização de dispatch / survey / sourcing PO).
  4. Salva no lead:
     - `assigned_supplier_contact`
     - `dispatch_assigned_utc`
     - `stripe_checkout_url`, `stripe_session_id`
     - `docusign_envelope_id`, `docusign_created_utc`
     - `alert_pending`, `alert_reason` se algo falhou (Stripe, DocuSign etc.).

- Atualiza `leads.json` com todos esses campos e timestamps. Cada lead vira um mini contrato vivo.

### 6. /api/outreach-email  (cron 30 min + botão "Gerar Outreach Drafts")
- Usa `OPENAI_API_KEY` (modelo `gpt-4o-mini`) para gerar rascunhos de cold outreach em inglês americano curto e natural.
- Dois grupos de rascunho:
  - Para compradores: "ZIP? When do you need it? Are you authorized under $15k on card?" / "We can source and ship this week, PO or card is fine."
  - Para fornecedores: "We have paid emergency / solar / industrial sourcing jobs in your area. You only pay per dispatched job. Can you stay on standby?"

- Esses rascunhos você copia/cola manualmente para prospecção 1:1 (e-mail, LinkedIn, etc.). Isso cria demanda real sem depender de tráfego do seu site.

### 7. /api/settings
- GET/POST de `data/settings.json` com os toggles:
  - `AUTO_DISPATCH_ENABLED`
  - `SCRAPER_ENABLED`
  - `INBOX_ENABLED`
  - `OUTREACH_ENABLED`
  - `BRAIN_ENABLED`
  - `BILLING_ENABLED`
  - `DOCUSIGN_ENABLED`
  - `ALERT_EMAIL` (usa `contact@blokerchain.business`)
- O painel `/public/dashboard.html` usa isso para ligar/desligar módulos direto do iPhone.

### 8. /api/marketplace
- Retorna todos os leads ordenados (mais novo primeiro) para alimentar `/public/dashboard.html` e `/public/marketplace.html`.
- A UI mostra tenant, urgência, estado, fornecedor vinculado, Stripe/DocuSign, alertas e bloqueios ("awaiting-authorization", "no_supplier_available").

---

## Interfaces web

### /public/index.html
- Landing (público) em inglês com 4 badges agora:
  - 24/7 Emergency Dispatch
  - Federal Micro‑Purchase <15k
  - Solar Credit Rush
  - Global B2B Sourcing
- Cards descrevendo cada linha, inclusive o "Global / Industrial Sourcing Desk".
- Posição da sua marca: você NÃO vende SaaS. Você é o Procurement / Dispatch Desk que resolve e cobra.

### /public/dashboard.html
- Cockpit privado, mobile-first.
- Você liga/desliga cada motor (Scraper, Inbox, Brain, Dispatch, Outreach, Billing, DocuSign).
- Botões de execução manual.
- Tabela de leads com status em tempo real e colunas de Stripe/DocuSign.

### /public/marketplace.html
- Quadro de oportunidades (todo lead vivo).
- Agora também mostra leads `global-sourcing-b2b` e marca urgência "this-week".
- Ajuda você ver onde está dinheiro pendurado esperando fornecedor ou autorização.

### /public/terms.html
- Blindagem jurídica padrão:
  - Você é "Dispatch / Procurement Desk".
  - Para público, comprador declara ter autoridade de micro-purchase (~15k USD) antes de mobilização.
  - Para privado/comercial/solar/b2b, comprador aceita taxa Stripe de mobilização / sourcing fee antes da visita / envio.
  - Execução técnica final é do fornecedor atribuído (roof crew, solar installer, industrial MRO vendor etc.).

---

## Cron / Agenda (netlify.toml)
- email-inbox      */5 min
- scrape-leads     */10 min
- scrape-suppliers 0 * * * *
- brain            */5 min
- outreach-email   */30 min
- dispatch         */5 min

Cada função checa `data/settings.json`. Se o módulo estiver OFF, responde `{skipped:true}` e não consome.

---

## Variáveis de ambiente necessárias (Netlify)
- `OPENAI_API_KEY`           (usa modelo gpt-4o-mini para escrever como humano sem assinar seu nome)
- `STRIPE_SECRET_KEY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `DOCUSIGN_BASE_URL`
- `DOCUSIGN_ACCOUNT_ID`
- `DOCUSIGN_ACCESS_TOKEN`
- `DOCUSIGN_TEMPLATE_ID`     (opcional)

---

## Como você ganha dinheiro agora
- Cobrança Stripe de taxa de mobilização / sourcing fee antes de mandar equipe / iniciar sourcing / agendar survey solar.
- Margem embutida nas peças (global-sourcing-b2b), porque você é o broker que acha o item e resolve a burocracia de compra.
- Leads de valor extremo (telhado pós-tempestade, mitigação de enchente, HVAC crítico, infraestrutura pública sob micro-purchase, instalação solar antes do corte de crédito, suprimento industrial urgente esta semana).

Você não está vendendo software.
Você está vendendo: "Sim, eu resolvo isso agora e mando o DocuSign/Stripe em minutos".


---

## Ingestão de Lead Real (manual-lead.js v21.0)

Cenário prático:
- Você vê um pedido real publicado (prefeitura pedindo bomba de água urgente, planta industrial pedindo luvas químicas e selos de bomba para esta semana, abrigo pedindo gerador diesel).
- Você copia esse texto real e cola no dashboard (seção "Adicionar Lead Manual (Real)").
- O dashboard faz POST em `/api/manual-lead` que grava esse lead imediatamente em `data/leads.json`.

Esse lead entra com:
- `tenant` que você escolheu (emergency-dispatch-exchange, federal-micro-purchase-fastlane, solar-home-us, global-sourcing-b2b)
- `authorized_under_15k` se for governo com cartão sob micro-purchase
- `buyer_type` (public, private, private-enterprise)
- `urgency` ("1-2h", "today", "this-week")
- `need` (texto real que você copiou)
- `state`, `zip`, `email`, `phone` se você tiver

Depois disso:
- `/api/brain` promove para `sale_ready:true` se fizer sentido (urgência alta ou B2B this-week).
- `/api/dispatch` tenta casar fornecedor, gerar Stripe, gerar DocuSign, e marcar timestamps.
- Se faltar autorização <15k no caso público ou faltar fornecedor naquele estado, o lead recebe `alert_pending:true` e NÃO bloqueia o resto da fila.

Esse fluxo resolve seu pedido: o sistema não depende de leads simulados. Você mesmo injeta os leads REAIS, em tempo real, conforme for encontrando pedidos em cidades, condados, utilidades públicas, plantas industriais, redes profissionais etc.


---

## Coleta Automática de Fontes Públicas (crawl-run.js v22.2)

- Arquivo `data/crawler-queue.json` mantém uma lista de URLs públicas (prefeituras, utilidades, boards de manutenção industrial, shelters de emergência etc.) por estado.
- Cada item tem: `url`, `state`, `tenantGuess`, `categoryGuess`, `buyer_typeGuess`, `active`, além de metadados de última coleta.

### /api/crawler-sources
- GET: retorna a fila atual (`crawler-queue.json`) pro dashboard mostrar.
- POST: adiciona uma nova fonte pública (URL + estado + tipo). Isso permite cadastrar uma prefeitura nova, uma planta industrial nova, etc., direto do iPhone.

### /api/crawl-run  (cron e botão "Run Crawl Now")
- Se `CRAWLER_ENABLED` estiver true em `data/settings.json`, essa função:
  1. Faz GET de cada `url` ativa da fila.
  2. Extrai blocos de texto que parecem pedidos urgentes reais ("need", "urgent", "must deliver", "purchase card", "under $15k", etc.).
  3. Extrai contato público (email/telefone).
  4. Cria leads reais em `data/leads.json`, marcando:
     - `tenant` (ex: `federal-micro-purchase-fastlane`, `global-sourcing-b2b`, `solar-home-us`, `emergency-dispatch-exchange`)
     - `urgency` estimada (`1-2h`, `today`, `this-week`)
     - `authorized_under_15k` = true se o texto falar de "micro-purchase", "under $15k", "card ready" etc.
  5. Atualiza `crawler-queue.json` com `last_seen_hash` e `last_crawl_utc` para não duplicar o mesmo chamado.

Esses leads entram iguais aos leads manuais:
- `status:"scraped"`
- `sale_ready:false`
- `source:"crawler"`

Depois:
- `/api/brain` marca `sale_ready:true` para o que for urgente ou "this-week" no caso do tenant `global-sourcing-b2b`.
- `/api/dispatch` tenta casar fornecedor, gerar Stripe, gerar DocuSign, e carimbar horário.
- Se faltar autorização <15k no lead público, ou faltar fornecedor em algum estado/categoria, o lead recebe `alert_pending:true` mas o resto do pipeline continua.

### Dashboard
O painel (`public/dashboard.html`) agora mostra:
- Toggle CRAWLER (ON/OFF).
- Botão "Run Crawl Now".
- Lista das fontes monitoradas.
- Formulário para adicionar novas fontes públicas.
- Card "Adicionar Lead Manual (Real)" continua, para você colar algo individual que você viu e quer inserir imediatamente.

Resultado: você consegue rodar uma central nacional de despacho/compras emergenciais 24/7, só adicionando fontes e supervisionando o painel no celular.


---

## Inteligência Matriz (intel-advisor-run.js v23.0)

- Objetivo: evolução contínua e autônoma da coleta de leads.
- A cada 5 minutos:
  1. Lê `leads.json` e mede onde está "pegando fogo" (estados com mais pedidos urgentes nas últimas 48h e categorias mais críticas: geradores, bombas de água, telhado, HVAC, solar backup, EPI industrial).
  2. Monta `hotStates` e `topCategories`.
  3. Chama o modelo OpenAI (4o mini) usando sua OPENAI_API_KEY para sugerir novos PORTAIS PÚBLICOS por estado (prefeituras, counties, utilities, boards de manutenção industrial, portais de procurement emergência, páginas de RFP/RFQ de gerador/bomba/telhado/solar etc.).
  4. Cada URL sugerida vira uma nova entrada em `crawler-queue.json` com `active:false`. Isso exige sua aprovação manual antes de começar a varrer. Nada começa sozinho sem que você permita.
  5. Gera `data/intel-report.json` com:
     - hotStates
     - topCategories
     - suggestions novas
     - addedCount

- Você vê isso na aba "Inteligência Matriz (IA)" do dashboard:
  * Botão "Run Intelligence Now"
  * Botão "Refresh Intelligence"
  * Box mostrando `intel-report.json`.

- Você pode ativar/desativar cada fonte sugerida (campo `active`) direto do painel mobile via PATCH `/api/crawler-sources`.

## crawler-run.js v23.0

- Agora roda a cada 5 minutos (cron Netlify).
- Percorre `crawler-queue.json` e coleta APENAS URLs marcadas `active:true`.
- Extrai blocos públicos que contenham linguagem de necessidade urgente ("need", "urgent", "emergency", "generator", "pump", "roof leak", "HVAC down", "micro-purchase", "under $15k", "purchase card ready", etc.).
- Identifica e-mails e telefones publicados nesses avisos.
- Se for comprador público e houver menção de micro-purchase / cartão, marca `authorized_under_15k:true`.
  Isso indica que a entidade pode comprar imediatamente com cartão corporativo/governamental até ~US$15k sem licitação completa, como permitido pelo FAR 2.101 atualizado em 1º de outubro de 2025.
- Cria leads reais em `data/leads.json` com `status:"scraped"` e `source:"crawler"`.

## settings.js v23.0

- GET /api/settings: retorna `data/settings.json`.
- POST /api/settings: patcha chaves como `CRAWLER_ENABLED`, `INTEL_ADVISOR_ENABLED`, `AUTO_DISPATCH_ENABLED`, etc.
- Isto te dá kill switch imediato (via iPhone) para parar coleta, parar despacho Stripe/DocuSign, etc.

## Painel Mobile

- Crawler Público (Automático):
  * Liga/Desliga coleta nacional (CRAWLER_ENABLED).
  * Adiciona novas fontes públicas (POST /api/crawler-sources).
  * Lista todas as fontes (`GET /api/crawler-sources`).
  * Atualiza `active` (PATCH /api/crawler-sources`).

- Inteligência Matriz (IA):
  * Run Intelligence Now (POST /api/intel-advisor-run).
  * Refresh Intelligence (GET /api/intel-advisor-run).
  * Visualiza hotStates / topCategories / novas URLs sugeridas.
  * Depois que uma sugestão aparece, você pode ativar aquela fonte no card de Crawler.

Com isso, o sistema cumpre:
- Busca contínua, a cada 5 minutos, em todos os estados dos EUA.
- Aprendizado incremental sobre quais estados/categorias estão gerando pedidos mais urgentes e com verba imediata (&lt;= US$15k cartão público no caso governo, peças industriais críticas, telhado/HVAC pós-tempestade, backup solar/gerador).
- Expansão automática da malha de coleta, sem esquecer as fontes antigas.
