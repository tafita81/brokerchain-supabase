// Jest setup file
// Configurações globais para testes

// Suprimir logs durante testes
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Timeout padrão para testes assíncronos
jest.setTimeout(10000);

// Variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_key';
process.env.STRIPE_SUCCESS_URL = 'https://test.com/success';
process.env.STRIPE_CANCEL_URL = 'https://test.com/cancel';
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long';
