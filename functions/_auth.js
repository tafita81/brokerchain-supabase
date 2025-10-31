// _auth.js
// Sistema de autenticação JWT para proteger rotas administrativas

const jwt = require('jsonwebtoken');
const { logInfo, logError, logWarn } = require('./_logger');

// Chave secreta para JWT (deve estar no .env em produção)
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Lista de usuários admin (em produção, isso deve vir do Supabase)
const ADMIN_USERS = [
  {
    id: 'admin-1',
    email: process.env.ADMIN_EMAIL || 'admin@brokerchain.com',
    password: process.env.ADMIN_PASSWORD || 'changeme123', // Hash em produção!
    role: 'admin',
  },
];

/**
 * Gera um token JWT para um usuário
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  logInfo('JWT token generated', {
    userId: user.id,
    email: user.email,
    expiresIn: JWT_EXPIRES_IN,
  });

  return token;
};

/**
 * Verifica e decodifica um token JWT
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    logWarn('Invalid JWT token', { error: error.message });
    return { valid: false, error: error.message };
  }
};

/**
 * Autentica usuário com email e senha
 * Em produção, isso deve usar bcrypt e buscar do banco
 */
const authenticateUser = (email, password) => {
  const user = ADMIN_USERS.find(
    (u) => u.email === email && u.password === password
  );

  if (!user) {
    logWarn('Authentication failed', { email });
    return null;
  }

  logInfo('User authenticated', { email, userId: user.id });
  return user;
};

/**
 * Middleware Express para proteger rotas com JWT
 */
const requireAuth = (req, res, next) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authorization header missing',
        message: 'Please provide a valid JWT token',
      });
    }

    // Formato esperado: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Invalid authorization format',
        message: 'Format should be: Bearer <token>',
      });
    }

    const token = parts[1];
    const { valid, decoded, error } = verifyToken(token);

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid token',
        message: error || 'Token verification failed',
      });
    }

    // Adicionar informações do usuário ao request
    req.user = decoded;
    next();
  } catch (error) {
    logError('Error in auth middleware', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Middleware para verificar role do usuário
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logWarn('Insufficient permissions', {
        userId: req.user.id,
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Handler de login
 */
const handleLogin = (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    const user = authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      expiresIn: JWT_EXPIRES_IN,
    });
  } catch (error) {
    logError('Error in login handler', error);
    res.status(500).json({
      error: 'Login error',
      message: 'Internal server error during login',
    });
  }
};

/**
 * Handler para verificar token
 */
const handleVerifyToken = (req, res) => {
  // Se chegou aqui, o token já foi verificado pelo middleware requireAuth
  res.status(200).json({
    success: true,
    user: req.user,
  });
};

/**
 * Handler para refresh de token
 */
const handleRefreshToken = (req, res) => {
  try {
    // Token já foi verificado pelo middleware
    const user = req.user;

    // Gerar novo token
    const newToken = generateToken(user);

    res.status(200).json({
      success: true,
      token: newToken,
      expiresIn: JWT_EXPIRES_IN,
    });
  } catch (error) {
    logError('Error refreshing token', error);
    res.status(500).json({
      error: 'Token refresh error',
      message: 'Internal server error during token refresh',
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateUser,
  requireAuth,
  requireRole,
  handleLogin,
  handleVerifyToken,
  handleRefreshToken,
  JWT_SECRET,
};
