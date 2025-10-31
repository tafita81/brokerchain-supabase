// _logger.js
// Sistema de logs estruturados com Winston
// Suporte para logs rotativos e formato JSON

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Níveis de log customizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Cores para cada nível
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Formato para desenvolvimento (console)
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

// Formato para produção (JSON estruturado)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transports
const transports = [
  // Console (sempre ativo)
  new winston.transports.Console({
    format: devFormat,
  }),
];

// Adicionar file transports apenas em produção ou se explicitamente configurado
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Logs rotativos para erros
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat,
    })
  );

  // Logs rotativos combinados
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat,
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
  exitOnError: false,
});

// Helper functions para logging estruturado
const structuredLog = (level, message, metadata = {}) => {
  logger.log(level, message, {
    ...metadata,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
};

// Funções de conveniência
const logError = (message, error = null, metadata = {}) => {
  structuredLog('error', message, {
    ...metadata,
    error: error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : null,
  });
};

const logWarn = (message, metadata = {}) => {
  structuredLog('warn', message, metadata);
};

const logInfo = (message, metadata = {}) => {
  structuredLog('info', message, metadata);
};

const logHttp = (message, metadata = {}) => {
  structuredLog('http', message, metadata);
};

const logDebug = (message, metadata = {}) => {
  structuredLog('debug', message, metadata);
};

// Log de requisições HTTP
const logRequest = (req, metadata = {}) => {
  logHttp('HTTP Request', {
    method: req.method,
    url: req.url || req.path,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    ...metadata,
  });
};

// Log de resposta HTTP
const logResponse = (req, res, duration, metadata = {}) => {
  logHttp('HTTP Response', {
    method: req.method,
    url: req.url || req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    ...metadata,
  });
};

// Log de operações de banco de dados
const logDatabaseOperation = (operation, table, metadata = {}) => {
  logDebug(`Database operation: ${operation}`, {
    operation,
    table,
    ...metadata,
  });
};

// Log de chamadas de API externa
const logExternalApiCall = (service, endpoint, metadata = {}) => {
  logInfo(`External API call: ${service}`, {
    service,
    endpoint,
    ...metadata,
  });
};

// Log de métricas de performance
const logPerformance = (operation, duration, metadata = {}) => {
  logInfo(`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  });
};

module.exports = {
  logger,
  logError,
  logWarn,
  logInfo,
  logHttp,
  logDebug,
  logRequest,
  logResponse,
  logDatabaseOperation,
  logExternalApiCall,
  logPerformance,
};
