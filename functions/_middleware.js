// _middleware.js
// Middlewares centralizados para Express: CORS, rate limiting, error handling

const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { logError, logRequest, logResponse, logWarn } = require('./_logger');
const { recordRequest } = require('./_monitor');

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

// Origens aprovadas (configurar via environment variable em produção)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://brokerchain.netlify.app',
      // Adicionar mais origens conforme necessário
    ];

/**
 * Configuração de CORS
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requisições sem origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Verificar se a origem está na lista de permitidas
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      logWarn('CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};

const corsMiddleware = cors(corsOptions);

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limiter geral para todas as rotas
 */
const generalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requisições por janela
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logWarn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
    });
  },
});

/**
 * Rate limiter mais restrito para rotas de autenticação
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas de login por janela
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again after 15 minutes',
  },
  skipSuccessfulRequests: true, // Não contar requisições bem-sucedidas
  handler: (req, res) => {
    logWarn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again after 15 minutes',
    });
  },
});

/**
 * Rate limiter para rotas de criação (POST)
 */
const createRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 criações por minuto
  message: {
    error: 'Too many create requests',
    message: 'Please slow down',
  },
});

// ============================================================================
// REQUEST LOGGING
// ============================================================================

/**
 * Middleware para logging de requisições HTTP
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log da requisição
  logRequest(req);

  // Capturar o fim da resposta
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;

    // Log da resposta
    logResponse(req, res, duration);

    // Registrar métricas
    recordRequest(req.path, success, duration);
  });

  next();
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handler de erros 404 (rota não encontrada)
 */
const notFoundHandler = (req, res) => {
  logWarn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
    path: req.path,
  });
};

/**
 * Handler global de erros
 */
const errorHandler = (err, req, res, next) => {
  // Log do erro
  logError('Unhandled error', err, {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS error',
      message: 'Origin not allowed',
    });
  }

  // Validation error (Joi)
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
      details: err.details,
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication error',
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication error',
      message: 'Token expired',
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.name,
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Wrapper para handlers assíncronos (evita try-catch em cada função)
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para validar Content-Type JSON
 */
const requireJsonContent = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Invalid Content-Type',
        message: 'Content-Type must be application/json',
      });
    }
  }

  next();
};

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Middleware para adicionar headers de segurança
 */
const securityHeaders = (req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );

  next();
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  corsMiddleware,
  generalRateLimiter,
  authRateLimiter,
  createRateLimiter,
  requestLogger,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  requireJsonContent,
  securityHeaders,
};
