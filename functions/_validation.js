// _validation.js
// Sistema de validação de dados usando Joi
// Schemas de validação para todas as entidades principais

const Joi = require('joi');

// ============================================================================
// SCHEMAS DE VALIDAÇÃO
// ============================================================================

// Schema para Lead
const leadSchema = Joi.object({
  id: Joi.string().optional(),
  title: Joi.string().required().min(3).max(500),
  body: Joi.string().allow('').max(5000),
  contact_email: Joi.string().email().allow(''),
  contact_phone: Joi.string()
    .pattern(/^[\d\s\-\(\)\+]+$/)
    .allow(''),
  state: Joi.string()
    .length(2)
    .uppercase()
    .pattern(/^[A-Z]{2}$/),
  zip: Joi.string()
    .pattern(/^\d{5}(-\d{4})?$/)
    .allow(''),
  buyer_type: Joi.string().valid('public', 'private', 'commercial', 'residential'),
  urgency: Joi.string().valid('1-2h', 'today', 'this-week', 'unknown'),
  category: Joi.string().max(100),
  tenant: Joi.string().valid(
    'emergency-dispatch-exchange',
    'federal-micro-purchase-fastlane',
    'solar-home-us',
    'global-sourcing-b2b'
  ),
  authorized_under_15k: Joi.boolean(),
  sale_ready: Joi.boolean(),
  status: Joi.string().valid(
    'scraped',
    'qualified',
    'dispatched',
    'contacted',
    'converted',
    'lost',
    'awaiting-authorization'
  ),
  source_url: Joi.string().uri().allow(''),
  source_channel: Joi.string().max(100),
  created_utc: Joi.date().iso(),
  dedup_hash: Joi.string().optional(),
}).or('contact_email', 'contact_phone'); // Pelo menos um contato é obrigatório

// Schema para Supplier
const supplierSchema = Joi.object({
  id: Joi.string().optional(),
  name: Joi.string().required().min(2).max(200),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/^[\d\s\-\(\)\+]+$/)
    .required(),
  state: Joi.string()
    .length(2)
    .uppercase()
    .required(),
  states_served: Joi.array().items(
    Joi.string()
      .length(2)
      .uppercase()
  ),
  categories: Joi.array().items(Joi.string().max(100)),
  active: Joi.boolean().default(true),
  rating: Joi.number().min(0).max(5),
  response_time_avg: Joi.string().max(50),
  created_utc: Joi.date().iso(),
});

// Schema para Buyer
const buyerSchema = Joi.object({
  id: Joi.string().optional(),
  dedupe_key: Joi.string().required(),
  contact_email: Joi.string().email().allow(''),
  contact_phone: Joi.string()
    .pattern(/^[\d\s\-\(\)\+]+$/)
    .allow(''),
  states: Joi.object().pattern(Joi.string(), Joi.boolean()),
  intents: Joi.object().pattern(Joi.string(), Joi.boolean()),
  authorized_under_15k: Joi.boolean(),
  buyer_type: Joi.string().valid('public', 'private', 'commercial', 'residential'),
  first_seen_utc: Joi.date().iso(),
  last_seen_utc: Joi.date().iso(),
});

// Schema para Settings
const settingSchema = Joi.object({
  key: Joi.string().required().min(1).max(100),
  value: Joi.any().required(),
});

// Schema para Tenant
const tenantSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required().min(3).max(200),
  description: Joi.string().max(1000),
  active: Joi.boolean().default(true),
  config: Joi.object(),
});

// Schema para autenticação JWT
const authSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

// Schema para variáveis de ambiente
const envSchema = Joi.object({
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_KEY: Joi.string().required(),
  OPENAI_API_KEY: Joi.string().required(),
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_SUCCESS_URL: Joi.string().uri().required(),
  STRIPE_CANCEL_URL: Joi.string().uri().required(),
  DOCUSIGN_BASE_URL: Joi.string().uri().required(),
  DOCUSIGN_ACCOUNT_ID: Joi.string().required(),
  DOCUSIGN_ACCESS_TOKEN: Joi.string().required(),
  DOCUSIGN_TEMPLATE_ID: Joi.string().required(),
  EMAIL_IMAP_USER: Joi.string().email().optional(),
  EMAIL_IMAP_PASS: Joi.string().optional(),
  EMAIL_SMTP_USER: Joi.string().email().optional(),
  EMAIL_SMTP_PASS: Joi.string().optional(),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'debug')
    .default('info'),
  JWT_SECRET: Joi.string().min(32).optional(),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
}).unknown(true); // Permite outras variáveis de ambiente

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================================================

/**
 * Valida dados contra um schema Joi
 * @param {Object} data - Dados a serem validados
 * @param {Joi.Schema} schema - Schema Joi para validação
 * @param {Object} options - Opções de validação
 * @returns {Object} - { error, value }
 */
const validate = (data, schema, options = {}) => {
  const defaultOptions = {
    abortEarly: false, // Retorna todos os erros, não apenas o primeiro
    stripUnknown: true, // Remove campos desconhecidos
    ...options,
  };

  return schema.validate(data, defaultOptions);
};

/**
 * Valida um Lead
 */
const validateLead = (data, options = {}) => {
  return validate(data, leadSchema, options);
};

/**
 * Valida um Supplier
 */
const validateSupplier = (data, options = {}) => {
  return validate(data, supplierSchema, options);
};

/**
 * Valida um Buyer
 */
const validateBuyer = (data, options = {}) => {
  return validate(data, buyerSchema, options);
};

/**
 * Valida uma Setting
 */
const validateSetting = (data, options = {}) => {
  return validate(data, settingSchema, options);
};

/**
 * Valida um Tenant
 */
const validateTenant = (data, options = {}) => {
  return validate(data, tenantSchema, options);
};

/**
 * Valida credenciais de autenticação
 */
const validateAuth = (data, options = {}) => {
  return validate(data, authSchema, options);
};

/**
 * Valida variáveis de ambiente
 */
const validateEnv = (env = process.env, options = {}) => {
  return validate(env, envSchema, options);
};

/**
 * Middleware Express para validação de body
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = validate(req.body, schema);

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation error',
        details: errors,
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Middleware Express para validação de query params
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = validate(req.query, schema);

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation error',
        details: errors,
      });
    }

    req.query = value;
    next();
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Schemas
  leadSchema,
  supplierSchema,
  buyerSchema,
  settingSchema,
  tenantSchema,
  authSchema,
  envSchema,

  // Funções de validação
  validate,
  validateLead,
  validateSupplier,
  validateBuyer,
  validateSetting,
  validateTenant,
  validateAuth,
  validateEnv,

  // Middlewares
  validateBody,
  validateQuery,
};
