// _validation.test.js
// Testes para o módulo de validação

const {
  validateLead,
  validateSupplier,
  validateBuyer,
  validateAuth,
  validateEnv,
} = require('./_validation');

describe('Validation Module', () => {
  describe('validateLead', () => {
    it('should validate a valid lead', () => {
      const lead = {
        title: 'Emergency HVAC repair needed',
        body: 'AC unit failed in data center',
        contact_email: 'buyer@example.com',
        state: 'TX',
        buyer_type: 'private',
        urgency: '1-2h',
        category: 'hvac',
        tenant: 'emergency-dispatch-exchange',
      };

      const { error, value } = validateLead(lead);

      expect(error).toBeUndefined();
      expect(value).toBeDefined();
      expect(value.title).toBe(lead.title);
    });

    it('should reject lead without contact info', () => {
      const lead = {
        title: 'Emergency repair',
        state: 'TX',
        buyer_type: 'private',
      };

      const { error } = validateLead(lead);

      expect(error).toBeDefined();
    });

    it('should reject lead with invalid state code', () => {
      const lead = {
        title: 'Emergency repair',
        contact_email: 'test@example.com',
        state: 'TEXAS', // Should be TX
        buyer_type: 'private',
      };

      const { error } = validateLead(lead);

      expect(error).toBeDefined();
    });

    it('should reject lead with invalid urgency', () => {
      const lead = {
        title: 'Emergency repair',
        contact_email: 'test@example.com',
        state: 'TX',
        buyer_type: 'private',
        urgency: 'invalid-urgency',
      };

      const { error } = validateLead(lead);

      expect(error).toBeDefined();
    });

    it('should accept lead with phone only', () => {
      const lead = {
        title: 'Emergency repair',
        contact_phone: '+1234567890',
        state: 'TX',
        buyer_type: 'private',
      };

      const { error } = validateLead(lead);

      expect(error).toBeUndefined();
    });
  });

  describe('validateSupplier', () => {
    it('should validate a valid supplier', () => {
      const supplier = {
        name: 'ABC Emergency Services',
        email: 'contact@abc.com',
        phone: '+1234567890',
        state: 'NY',
        states_served: ['NY', 'NJ', 'CT'],
        categories: ['hvac', 'plumbing'],
        active: true,
      };

      const { error, value } = validateSupplier(supplier);

      expect(error).toBeUndefined();
      expect(value).toBeDefined();
      expect(value.name).toBe(supplier.name);
    });

    it('should reject supplier without required fields', () => {
      const supplier = {
        name: 'ABC Services',
        // missing email, phone, state
      };

      const { error } = validateSupplier(supplier);

      expect(error).toBeDefined();
    });

    it('should reject supplier with invalid email', () => {
      const supplier = {
        name: 'ABC Services',
        email: 'invalid-email',
        phone: '+1234567890',
        state: 'NY',
      };

      const { error } = validateSupplier(supplier);

      expect(error).toBeDefined();
    });
  });

  describe('validateBuyer', () => {
    it('should validate a valid buyer', () => {
      const buyer = {
        dedupe_key: 'buyer@example.com',
        contact_email: 'buyer@example.com',
        states: { TX: true, CA: true },
        intents: { 'emergency-dispatch-exchange': true },
        authorized_under_15k: true,
        buyer_type: 'public',
      };

      const { error, value } = validateBuyer(buyer);

      expect(error).toBeUndefined();
      expect(value).toBeDefined();
    });

    it('should reject buyer without dedupe_key', () => {
      const buyer = {
        contact_email: 'buyer@example.com',
        buyer_type: 'public',
      };

      const { error } = validateBuyer(buyer);

      expect(error).toBeDefined();
    });
  });

  describe('validateAuth', () => {
    it('should validate valid credentials', () => {
      const credentials = {
        email: 'admin@example.com',
        password: 'securepassword123',
      };

      const { error, value } = validateAuth(credentials);

      expect(error).toBeUndefined();
      expect(value).toBeDefined();
    });

    it('should reject invalid email', () => {
      const credentials = {
        email: 'invalid-email',
        password: 'securepassword123',
      };

      const { error } = validateAuth(credentials);

      expect(error).toBeDefined();
    });

    it('should reject short password', () => {
      const credentials = {
        email: 'admin@example.com',
        password: 'short',
      };

      const { error } = validateAuth(credentials);

      expect(error).toBeDefined();
    });
  });

  describe('validateEnv', () => {
    it('should validate required environment variables', () => {
      const env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_KEY: 'test-key',
        OPENAI_API_KEY: 'sk-test',
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_SUCCESS_URL: 'https://test.com/success',
        STRIPE_CANCEL_URL: 'https://test.com/cancel',
        DOCUSIGN_BASE_URL: 'https://test.docusign.net',
        DOCUSIGN_ACCOUNT_ID: 'test-account',
        DOCUSIGN_ACCESS_TOKEN: 'test-token',
        DOCUSIGN_TEMPLATE_ID: 'test-template',
      };

      const { error } = validateEnv(env);

      expect(error).toBeUndefined();
    });

    it('should reject missing required variables', () => {
      const env = {
        SUPABASE_URL: 'https://test.supabase.co',
        // Missing other required vars
      };

      const { error } = validateEnv(env);

      expect(error).toBeDefined();
    });
  });
});
