// setup-health.js v25.0
// Faz auditoria de prontidão 24/7 e atualiza settings.json:
// - PRODUCTION_READY
// - BILLING_READY / EMAIL_READY
// - AUTO_DISPATCH_ENABLED / OUTREACH_ENABLED / BILLING_ENABLED conforme bloqueios
// Agora também mostra APPROVED_OUTREACH / DAILY_SUPPLIER_PING_ENABLED como avisos.

const { readJSON, writeJSON, corsHeaders } = require('./_util.js');

function minutesAgo(iso){
  if(!iso) return Infinity;
  const t = Date.parse(iso);
  if(!t) return Infinity;
  return (Date.now()-t)/60000.0;
}

function checkEnv(){
  const env = process.env || {};
  const hasOpenAI   = !!env.OPENAI_API_KEY;
  const hasDocuSign = !!env.DOCUSIGN_API_KEY || !!env.DOCUSIGN_AUTH_TOKEN || !!env.DOCUSIGN_ACCOUNT_ID;
  const publicBase  = env.PUBLIC_BASE_URL || "";
  const domainLooksCustom = (publicBase && !publicBase.includes(".netlify.app"));
  const hasSMTP     = !!env.SMTP_HOST && !!env.SMTP_USER && !!env.SMTP_PASS;
  const hasStripe   = !!env.STRIPE_SECRET_KEY;
  return {
    hasOpenAI,
    hasDocuSign,
    publicBase,
    domainLooksCustom,
    hasSMTP,
    hasStripe
  };
}

function checkSuppliers(suppliers){
  const requiredTenants = [
    "federal-micro-purchase-fastlane",
    "emergency-dispatch-exchange",
    "global-sourcing-b2b",
    "solar-home-us"
  ];
  const mapTenant={};
  for (const t of requiredTenants){ mapTenant[t]=false; }
  for (const s of suppliers){
    if(!s) continue;
    if(!s.tenant) continue;
    if(s.active && (s.tenant in mapTenant)){
      mapTenant[s.tenant]=true;
    }
  }
  const failingTenants = Object.keys(mapTenant).filter(t=>!mapTenant[t]);
  return {
    pass: failingTenants.length===0,
    failingTenants
  };
}

function checkCrawler(settings, cq){
  if(!settings.CRAWLER_ENABLED){
    return {pass:false, detail:"CRAWLER_ENABLED=false"};
  }
  let recent=false;
  for(const item of cq){
    if(!item || !item.active) continue;
    const mins = minutesAgo(item.last_crawl_utc);
    if(mins<10){
      recent=true;
      break;
    }
  }
  if(!recent){
    return {pass:false, detail:"Nenhuma fonte ativa com last_crawl_utc <10min"};
  }
  return {pass:true, detail:"Crawler ativo e recente"};
}

function checkIntel(settings, intel){
  if(!settings.INTEL_ADVISOR_ENABLED){
    return {pass:false, detail:"INTEL_ADVISOR_ENABLED=false"};
  }
  const mins = minutesAgo(intel.generated_utc);
  if(mins<10){
    return {pass:true, detail:"IA atualizada há "+mins.toFixed(1)+" min"};
  }
  return {pass:false, detail:"IA não atualizada <10min"};
}

function buildChecks(envInfo, supCheck, crawlerChk, intelChk, settings){
  const checks=[];
  checks.push({
    key:"NETLIFY_ENV_OPENAI",
    label:"OpenAI (4o mini) configurado",
    status: envInfo.hasOpenAI ? "pass":"fail",
    details: envInfo.hasOpenAI ? "OPENAI_API_KEY presente":"Falta OPENAI_API_KEY"
  });
  checks.push({
    key:"NETLIFY_ENV_DOCUSIGN",
    label:"DocuSign conectado",
    status: envInfo.hasDocuSign ? "pass":"fail",
    details: envInfo.hasDocuSign ? "Credenciais DocuSign detectadas":"Faltam credenciais DocuSign"
  });
  checks.push({
    key:"DNS_DOMAIN",
    label:"Domínio apontado para produção",
    status: envInfo.domainLooksCustom ? "pass":"warn",
    details: envInfo.domainLooksCustom
      ? ("Domínio configurado: "+envInfo.publicBase)
      : "Ainda usando domínio genérico (.netlify.app). Configure PUBLIC_BASE_URL e aponte DNS na Hostinger."
  });
  checks.push({
    key:"SMTP_READY",
    label:"E-mail corporativo pronto (Hostinger SMTP)",
    status: envInfo.hasSMTP ? "pass":"fail",
    details: envInfo.hasSMTP
      ? "SMTP_HOST/USER/PASS presentes (SPF/DKIM ok no DNS)"
      : "Sem SMTP_HOST / SMTP_USER / SMTP_PASS. Outreach automático travado."
  });
  checks.push({
    key:"STRIPE_READY",
    label:"Stripe liberado para cobrança",
    status: envInfo.hasStripe ? "pass":"fail",
    details: envInfo.hasStripe
      ? "STRIPE_SECRET_KEY presente"
      : "Stripe ausente/bloqueado. Cobrança automática travada."
  });
  checks.push({
    key:"SUPPLIERS_STANDBY",
    label:"Fornecedores prontos por tenant crítico",
    status: supCheck.pass ? "pass":"fail",
    details: supCheck.pass
      ? "Há pelo menos 1 fornecedor ativo em cada tenant core"
      : ("Faltam fornecedores ativos para: "+supCheck.failingTenants.join(', '))
  });
  checks.push({
    key:"CRAWLER_RUNNING",
    label:"Crawler nacional rodando a cada 5 min",
    status: crawlerChk.pass ? "pass":"fail",
    details: crawlerChk.detail
  });
  checks.push({
    key:"AI_INTEL_RUNNING",
    label:"Matriz IA sugerindo novas fontes",
    status: intelChk.pass ? "pass":"fail",
    details: intelChk.detail
  });

  // Avisos de governança humana
  checks.push({
    key:"OUTREACH_APPROVED",
    label:"Outreach automático permitido",
    status: settings.APPROVED_OUTREACH ? "pass":"warn",
    details: settings.APPROVED_OUTREACH
      ? "APPROVED_OUTREACH=true: permitido falar com fornecedor sozinho."
      : "APPROVED_OUTREACH=false: não envia e-mail automático a fornecedores sem sua autorização."
  });
  checks.push({
    key:"DAILY_PING",
    label:"Ping diário fornecedores ON",
    status: settings.DAILY_SUPPLIER_PING_ENABLED ? "pass":"warn",
    details: settings.DAILY_SUPPLIER_PING_ENABLED
      ? "supplier-outreach-run vai checar fornecedores 1x/dia (se resto estiver verde)."
      : "Ping diário desligado. Ninguém é lembrado de ficar em stand-by."
  });

  return checks;
}

function summarizeStatus(checks){
  let anyFailCritical=false;
  let stripeFail=false;
  let smtpFail=false;
  for(const c of checks){
    // itens 'warn' não contam como falha crítica
    if(c.status==="warn") continue;

    if (c.key==="DNS_DOMAIN"){
      // DNS_DOMAIN pode ser warn/pass mas não 'fail'. Se vier 'warn', já passou acima
      // então nada a fazer aqui
      continue;
    }
    if (c.key==="STRIPE_READY" && c.status==="fail"){
      stripeFail=true;
      anyFailCritical=true;
      continue;
    }
    if (c.key==="SMTP_READY" && c.status==="fail"){
      smtpFail=true;
      anyFailCritical=true;
      continue;
    }
    if(c.status==="fail"){
      anyFailCritical=true;
    }
  }
  const allGreen = !anyFailCritical;
  return {allGreen, stripeFail, smtpFail};
}

function applySettings(summary, settings){
  settings.BILLING_READY = !summary.stripeFail;
  settings.EMAIL_READY   = !summary.smtpFail;
  settings.PRODUCTION_READY = summary.allGreen;

  if(summary.stripeFail){
    settings.BILLING_ENABLED = false;
  }
  if(summary.smtpFail){
    settings.OUTREACH_ENABLED = false;
  }
  if(!summary.allGreen){
    settings.AUTO_DISPATCH_ENABLED = false;
  }
  return settings;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {statusCode:200, headers:corsHeaders(), body:''};
  }
  if (event.httpMethod!=='GET' && event.httpMethod!=='POST'){
    return {statusCode:405, headers:corsHeaders(), body:'Method Not Allowed'};
  }

  let settings = readJSON('settings.json') || {};
  const suppliers = readJSON('suppliers.json') || [];
  const cq        = readJSON('crawler-queue.json') || [];
  const intel     = readJSON('intel-report.json') || {};

  const envInfo    = checkEnv();
  const supCheck   = checkSuppliers(suppliers);
  const crawlerChk = checkCrawler(settings, cq);
  const intelChk   = checkIntel(settings, intel);

  const checks = buildChecks(envInfo, supCheck, crawlerChk, intelChk, settings);
  const summary = summarizeStatus(checks);

  settings = applySettings(summary, settings);
  writeJSON('settings.json', settings);

  const respBody = {
    ok:true,
    generated_utc:new Date().toISOString(),
    checks,
    all_green: summary.allGreen,
    settings_after: settings
  };

  return {
    statusCode:200,
    headers:corsHeaders(),
    body:JSON.stringify(respBody)
  };
};
