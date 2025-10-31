// _auth.test.js
// Testes para o módulo de autenticação JWT

const {
  generateToken,
  verifyToken,
  authenticateUser,
} = require('./_auth');

describe('Authentication Module', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      const token = generateToken(user);
      const { valid, decoded } = verifyToken(token);

      expect(valid).toBe(true);
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    it('should reject an invalid token', () => {
      const { valid, error } = verifyToken('invalid-token');

      expect(valid).toBe(false);
      expect(error).toBeDefined();
    });

    it('should reject a tampered token', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      const token = generateToken(user);
      const tamperedToken = token + 'tampered';
      const { valid, error } = verifyToken(tamperedToken);

      expect(valid).toBe(false);
      expect(error).toBeDefined();
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate valid credentials', () => {
      const email = process.env.ADMIN_EMAIL || 'admin@brokerchain.com';
      const password = process.env.ADMIN_PASSWORD || 'changeme123';

      const user = authenticateUser(email, password);

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.role).toBe('admin');
    });

    it('should reject invalid credentials', () => {
      const user = authenticateUser('wrong@example.com', 'wrongpassword');

      expect(user).toBeNull();
    });

    it('should reject valid email with wrong password', () => {
      const email = process.env.ADMIN_EMAIL || 'admin@brokerchain.com';
      const user = authenticateUser(email, 'wrongpassword');

      expect(user).toBeNull();
    });
  });
});
