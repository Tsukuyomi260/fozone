/**
 * Middleware d'authentification
 * Vérifie les tokens JWT et les sessions Supabase
 */

const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

/**
 * Middleware pour vérifier l'authentification via JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Vérifier que JWT_SECRET est configuré
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error.' 
      });
    }

    // Vérifier le token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      logger.error('JWT verification error:', {
        message: jwtError.message,
        name: jwtError.name
      });
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired. Please login again.' 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(403).json({ 
          error: 'Invalid token format.' 
        });
      } else {
        return res.status(403).json({ 
          error: 'Invalid token.' 
        });
      }
    }
    
    // Vérifier que userId existe dans le token
    if (!decoded.userId) {
      logger.error('Token missing userId:', decoded);
      return res.status(403).json({ 
        error: 'Invalid token payload.' 
      });
    }
    
    // Vérifier que l'utilisateur existe toujours dans Supabase
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      logger.error('User not found in database:', { userId: decoded.userId, error });
      return res.status(401).json({ 
        error: 'User not found.' 
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account is deactivated.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(403).json({ 
      error: 'Invalid token.' 
    });
  }
};

/**
 * Middleware pour vérifier le rôle admin
 */
// Reserve au compte plateforme: valide les retraits, voit tous les
// promoteurs. 'admin' designe desormais un promoteur ordinaire, proprietaire
// de ses propres zones - il ne doit surtout pas passer ce controle.
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    return res.status(403).json({
      error: 'Access denied. Super admin role required.'
    });
  }
};

/**
 * Middleware pour vérifier l'authentification via Supabase session
 * Alternative pour les appels depuis le frontend
 */
const authenticateSupabase = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Vérifier le token avec Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Invalid or expired token.' 
      });
    }

    req.user = {
      id: user.id,
      email: user.email
    };

    next();
  } catch (error) {
    logger.error('Supabase authentication error:', error);
    return res.status(403).json({ 
      error: 'Invalid token.' 
    });
  }
};

module.exports = {
  authenticateToken,
  authenticateSupabase,
  requireSuperAdmin
};

