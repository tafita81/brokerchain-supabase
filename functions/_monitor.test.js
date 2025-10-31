// _monitor.test.js
// Testes para o módulo de monitoramento

const {
  recordRequest,
  recordLeadOperation,
  recordExternalApiCall,
  getMetrics,
  resetMetrics,
} = require('./_monitor');

describe('Monitor Module', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordRequest', () => {
    it('should record successful request', () => {
      recordRequest('/api/leads', true, 100);

      const metrics = getMetrics();

      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.success).toBe(1);
      expect(metrics.requests.errors).toBe(0);
    });

    it('should record failed request', () => {
      recordRequest('/api/leads', false, 200);

      const metrics = getMetrics();

      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.success).toBe(0);
      expect(metrics.requests.errors).toBe(1);
    });

    it('should record multiple requests by endpoint', () => {
      recordRequest('/api/leads', true, 100);
      recordRequest('/api/leads', true, 150);
      recordRequest('/api/suppliers', false, 200);

      const metrics = getMetrics();

      expect(metrics.requests.total).toBe(3);
      expect(metrics.requests.byEndpoint['/api/leads'].total).toBe(2);
      expect(metrics.requests.byEndpoint['/api/suppliers'].total).toBe(1);
    });

    it('should calculate average response time', () => {
      recordRequest('/api/leads', true, 100);
      recordRequest('/api/leads', true, 200);

      const metrics = getMetrics();

      expect(metrics.performance.averageResponseTime).toBe(150);
    });
  });

  describe('recordLeadOperation', () => {
    it('should record lead operations', () => {
      recordLeadOperation('scraped');
      recordLeadOperation('qualified');
      recordLeadOperation('dispatched');

      const metrics = getMetrics();

      expect(metrics.leads.scraped).toBe(1);
      expect(metrics.leads.qualified).toBe(1);
      expect(metrics.leads.dispatched).toBe(1);
    });
  });

  describe('recordExternalApiCall', () => {
    it('should record external API calls', () => {
      recordExternalApiCall('openai', true, 500);
      recordExternalApiCall('stripe', true, 300);

      const metrics = getMetrics();

      expect(metrics.external_apis.openai.calls).toBe(1);
      expect(metrics.external_apis.stripe.calls).toBe(1);
    });

    it('should record API errors', () => {
      recordExternalApiCall('openai', false, 500);

      const metrics = getMetrics();

      expect(metrics.external_apis.openai.errors).toBe(1);
    });

    it('should calculate average response time for API calls', () => {
      recordExternalApiCall('openai', true, 400);
      recordExternalApiCall('openai', true, 600);

      const metrics = getMetrics();

      expect(metrics.external_apis.openai.avgResponseTime).toBe(500);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics with uptime', () => {
      const metrics = getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.uptime).toBeDefined();
      expect(metrics.uptime.ms).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeDefined();
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', () => {
      recordRequest('/api/leads', true, 100);
      recordLeadOperation('scraped');

      resetMetrics();

      const metrics = getMetrics();

      expect(metrics.requests.total).toBe(0);
      expect(metrics.leads.scraped).toBe(0);
    });
  });
});
