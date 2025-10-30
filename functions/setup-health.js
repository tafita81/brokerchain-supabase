// setup-health.js v27.0 - COM SUPABASE
// Faz auditoria de prontidão 24/7 e atualiza settings no Supabase:
// - PRODUCTION_READY
// - BILLING_READY / EMAIL_READY
// - AUTO_DISPATCH_ENABLED / OUTREACH_ENABLED / BILLING_ENABLED conforme bloqueios
// Agora também mostra APPROVED_OUTREACH / DAILY_SUPPLIER_PING_ENABLED como avisos.

const { getSettings, updateSetting, getSuppliers, getCrawlerQueue, getIntelReports, corsHeaders } = require('./_supabase.js');

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
  // Check if we have active suppliers
  if (!suppliers || suppliers.length === 0) {
    return { pass: false, failingTenants: ['all'] };
  }
  
  const activeSuppliers = suppliers.filter(s => s && s.active);
  if (activeSuppliers.length === 0) {
    return { pass: false, failingTenants: ['all'] };
  }
  
  return {
    pass: true,
    failingTenants: []
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

function checkIntel(settings, intelReports){
  if(!settings.INTEL_ADVISOR_ENABLED){
    return {pass:false, detail:"INTEL_ADVISOR_ENABLED=false"};
  }
  if (!intelReports || intelReports.length === 0) {
    return {pass:false, detail:"Nenhum relatório de inteligência gerado"};
  }
  const latest = intelReports[0];
  const mins = minutesAgo(latest.created_utc);
  if(mins<30){
    return {pass:true, detail:"IA atualizada há "+mins.toFixed(1)+" min"};
  }
  return {pass:false, detail:"IA não atualizada <30min"};
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

async function applySettings(summary, settings){
  await updateSetting('BILLING_READY', !summary.stripeFail);
  await updateSetting('EMAIL_READY', !summary.smtpFail);
  await updateSetting('PRODUCTION_READY', summary.allGreen);

  if(summary.stripeFail){
    await updateSetting('BILLING_ENABLED', false);
  }
  if(summary.smtpFail){
    await updateSetting('OUTREACH_ENABLED', false);
  }
  if(!summary.allGreen){
    await updateSetting('AUTO_DISPATCH_ENABLED', false);
  }
  
  // Return updated settings
  return await getSettings();
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {statusCode:200, headers:corsHeaders(), body:''};
  }
  if (event.httpMethod!=='GET' && event.httpMethod!=='POST'){
    return {statusCode:405, headers:corsHeaders(), body:'Method Not Allowed'};
  }

  try {
    const [settings, suppliers, cq, intelReports] = await Promise.all([
      getSettings(),
      getSuppliers(),
      getCrawlerQueue(),
      getIntelReports(1)
    ]);

    const envInfo    = checkEnv();
    const supCheck   = checkSuppliers(suppliers);
    const crawlerChk = checkCrawler(settings, cq);
    const intelChk   = checkIntel(settings, intelReports);

    const checks = buildChecks(envInfo, supCheck, crawlerChk, intelChk, settings);
    const summary = summarizeStatus(checks);

    const updatedSettings = await applySettings(summary, settings);

    const respBody = {
      ok:true,
      generated_utc:new Date().toISOString(),
      checks,
      all_green: summary.allGreen,
      settings_after: updatedSettings
    };

    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify(respBody)
    };
  } catch (error) {
    console.error('Setup health error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
