// _env_validator.js
// Valida variáveis de ambiente no início da aplicação

const { validateEnv } = require('./_validation');
const { logInfo, logError, logWarn } = require('./_logger');

/**
 * Valida e carrega variáveis de ambiente
 * Deve ser chamado no início da aplicação
 */
function validateEnvironment() {
  logInfo('Validating environment variables...');

  const { error, value } = validateEnv();

  if (error) {
    const errorDetails = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    logError('Environment validation failed', null, {
      errors: errorDetails,
    });

    // Em produção, falhar completamente se variáveis críticas estão faltando
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: Required environment variables are missing or invalid');
      console.error(JSON.stringify(errorDetails, null, 2));
      process.exit(1);
    } else {
      // Em desenvolvimento, apenas avisar
      logWarn('Environment validation failed - continuing in development mode', {
        errors: errorDetails,
      });
    }
  } else {
    logInfo('Environment validation passed', {
      nodeEnv: value.NODE_ENV,
      logLevel: value.LOG_LEVEL,
    });
  }

  return value;
}

/**
 * Verifica se todas as variáveis críticas estão presentes
 */
function checkCriticalEnvVars() {
  const critical = {
    supabase: ['SUPABASE_URL', 'SUPABASE_KEY'],
    openai: ['OPENAI_API_KEY'],
    stripe: ['STRIPE_SECRET_KEY', 'STRIPE_SUCCESS_URL', 'STRIPE_CANCEL_URL'],
    docusign: [
      'DOCUSIGN_BASE_URL',
      'DOCUSIGN_ACCOUNT_ID',
      'DOCUSIGN_ACCESS_TOKEN',
      'DOCUSIGN_TEMPLATE_ID',
    ],
  };

  const missing = {};
  let hasMissing = false;

  for (const [service, vars] of Object.entries(critical)) {
    const serviceMissing = vars.filter((v) => !process.env[v]);
    if (serviceMissing.length > 0) {
      missing[service] = serviceMissing;
      hasMissing = true;
    }
  }

  if (hasMissing) {
    logWarn('Critical environment variables missing', { missing });
    return { ok: false, missing };
  }

  logInfo('All critical environment variables are present');
  return { ok: true };
}

/**
 * Retorna status das configurações de ambiente
 */
function getEnvStatus() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    services: {
      supabase: {
        configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
        url: process.env.SUPABASE_URL ? '***' : null,
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
      },
      stripe: {
        configured: !!process.env.STRIPE_SECRET_KEY,
      },
      docusign: {
        configured: !!(
          process.env.DOCUSIGN_BASE_URL &&
          process.env.DOCUSIGN_ACCOUNT_ID &&
          process.env.DOCUSIGN_ACCESS_TOKEN
        ),
      },
      email: {
        imap: !!process.env.EMAIL_IMAP_USER,
        smtp: !!process.env.EMAIL_SMTP_USER,
      },
    },
    security: {
      jwtSecret: !!process.env.JWT_SECRET,
      allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').length
        : 0,
    },
  };
}

module.exports = {
  validateEnvironment,
  checkCriticalEnvVars,
  getEnvStatus,
};
