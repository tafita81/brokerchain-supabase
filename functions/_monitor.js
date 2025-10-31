// _monitor.js
// Sistema de monitoramento com métricas e health checks

const { logInfo, logError, logWarn } = require('./_logger');
const { getSupabaseClient } = require('./_supabase');

// Métricas em memória
const metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    byEndpoint: {},
  },
  leads: {
    scraped: 0,
    qualified: 0,
    dispatched: 0,
    converted: 0,
  },
  performance: {
    averageResponseTime: 0,
    responseTimes: [],
  },
  external_apis: {
    openai: { calls: 0, errors: 0, avgResponseTime: 0 },
    stripe: { calls: 0, errors: 0, avgResponseTime: 0 },
    docusign: { calls: 0, errors: 0, avgResponseTime: 0 },
  },
  uptime: {
    startTime: Date.now(),
  },
};

/**
 * Registra uma requisição HTTP
 */
const recordRequest = (endpoint, success = true, responseTime = 0) => {
  metrics.requests.total++;
  
  if (success) {
    metrics.requests.success++;
  } else {
    metrics.requests.errors++;
  }

  // Registrar por endpoint
  if (!metrics.requests.byEndpoint[endpoint]) {
    metrics.requests.byEndpoint[endpoint] = {
      total: 0,
      success: 0,
      errors: 0,
    };
  }
  
  metrics.requests.byEndpoint[endpoint].total++;
  if (success) {
    metrics.requests.byEndpoint[endpoint].success++;
  } else {
    metrics.requests.byEndpoint[endpoint].errors++;
  }

  // Registrar tempo de resposta
  recordResponseTime(responseTime);
};

/**
 * Registra tempo de resposta
 */
const recordResponseTime = (time) => {
  metrics.performance.responseTimes.push(time);
  
  // Manter apenas as últimas 100 requisições
  if (metrics.performance.responseTimes.length > 100) {
    metrics.performance.responseTimes.shift();
  }

  // Calcular média
  const sum = metrics.performance.responseTimes.reduce((a, b) => a + b, 0);
  metrics.performance.averageResponseTime =
    sum / metrics.performance.responseTimes.length;
};

/**
 * Registra operação de lead
 */
const recordLeadOperation = (operation) => {
  if (metrics.leads[operation] !== undefined) {
    metrics.leads[operation]++;
  }
};

/**
 * Registra chamada de API externa
 */
const recordExternalApiCall = (service, success = true, responseTime = 0) => {
  if (metrics.external_apis[service]) {
    metrics.external_apis[service].calls++;
    
    if (!success) {
      metrics.external_apis[service].errors++;
    }

    // Calcular média de tempo de resposta
    const current = metrics.external_apis[service].avgResponseTime;
    const calls = metrics.external_apis[service].calls;
    metrics.external_apis[service].avgResponseTime =
      (current * (calls - 1) + responseTime) / calls;
  }
};

/**
 * Obtém métricas atuais
 */
const getMetrics = () => {
  const uptime = Date.now() - metrics.uptime.startTime;
  
  return {
    ...metrics,
    uptime: {
      ms: uptime,
      seconds: Math.floor(uptime / 1000),
      minutes: Math.floor(uptime / 60000),
      hours: Math.floor(uptime / 3600000),
    },
    timestamp: new Date().toISOString(),
  };
};

/**
 * Reseta métricas
 */
const resetMetrics = () => {
  metrics.requests = {
    total: 0,
    success: 0,
    errors: 0,
    byEndpoint: {},
  };
  metrics.leads = {
    scraped: 0,
    qualified: 0,
    dispatched: 0,
    converted: 0,
  };
  metrics.performance = {
    averageResponseTime: 0,
    responseTimes: [],
  };
  metrics.external_apis = {
    openai: { calls: 0, errors: 0, avgResponseTime: 0 },
    stripe: { calls: 0, errors: 0, avgResponseTime: 0 },
    docusign: { calls: 0, errors: 0, avgResponseTime: 0 },
  };
  
  logInfo('Metrics reset');
};

/**
 * Health check do sistema
 */
const healthCheck = async () => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check 1: Supabase connectivity
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('settings').select('key').limit(1);
    
    health.checks.supabase = {
      status: error ? 'unhealthy' : 'healthy',
      message: error ? error.message : 'Connected',
    };
    
    if (error) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.supabase = {
      status: 'unhealthy',
      message: error.message,
    };
    health.status = 'unhealthy';
  }

  // Check 2: Environment variables
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY',
  ];
  
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  
  health.checks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    message:
      missingEnvVars.length === 0
        ? 'All required environment variables are set'
        : `Missing: ${missingEnvVars.join(', ')}`,
  };
  
  if (missingEnvVars.length > 0) {
    health.status = 'unhealthy';
  }

  // Check 3: Memory usage
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  };
  
  health.checks.memory = {
    status: memUsageMB.heapUsed < 500 ? 'healthy' : 'warning',
    usage: memUsageMB,
    message: `Heap used: ${memUsageMB.heapUsed}MB`,
  };

  // Check 4: Error rate
  const errorRate =
    metrics.requests.total > 0
      ? (metrics.requests.errors / metrics.requests.total) * 100
      : 0;
  
  health.checks.errorRate = {
    status: errorRate < 5 ? 'healthy' : errorRate < 10 ? 'warning' : 'unhealthy',
    rate: errorRate.toFixed(2) + '%',
    message: `${metrics.requests.errors} errors out of ${metrics.requests.total} requests`,
  };
  
  if (errorRate >= 10) {
    health.status = 'degraded';
  }

  // Check 5: Uptime
  const uptime = Date.now() - metrics.uptime.startTime;
  health.checks.uptime = {
    status: 'healthy',
    uptime: {
      ms: uptime,
      hours: Math.floor(uptime / 3600000),
    },
    message: `Running for ${Math.floor(uptime / 3600000)} hours`,
  };

  return health;
};

/**
 * Monitor do sistema (execução periódica)
 */
const monitorSystem = async () => {
  try {
    logInfo('Running system monitor...');

    const health = await healthCheck();
    const currentMetrics = getMetrics();

    // Log status
    logInfo('System health check completed', {
      status: health.status,
      errorRate: health.checks.errorRate?.rate,
      memory: health.checks.memory?.usage.heapUsed + 'MB',
    });

    // Alertas
    if (health.status === 'unhealthy') {
      logError('System is unhealthy!', null, { health });
    } else if (health.status === 'degraded') {
      logWarn('System is degraded', { health });
    }

    // Check high error rate
    const errorRate =
      metrics.requests.total > 0
        ? (metrics.requests.errors / metrics.requests.total) * 100
        : 0;
    
    if (errorRate > 10 && metrics.requests.total > 10) {
      logWarn('High error rate detected', {
        errorRate: errorRate.toFixed(2) + '%',
        total: metrics.requests.total,
        errors: metrics.requests.errors,
      });
    }

    // Check memory
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > 500) {
      logWarn('High memory usage', { heapUsedMB });
    }

    return {
      health,
      metrics: currentMetrics,
    };
  } catch (error) {
    logError('Error in system monitor', error);
    return null;
  }
};

module.exports = {
  monitorSystem,
  healthCheck,
  getMetrics,
  resetMetrics,
  recordRequest,
  recordResponseTime,
  recordLeadOperation,
  recordExternalApiCall,
};
