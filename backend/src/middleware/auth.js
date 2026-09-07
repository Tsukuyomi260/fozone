/**
 * Middleware d'authentification
 * Vérifie les tokens JWT et les sessions Supabase
 */

const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

// Contexte d'authentification mis en cache quelques secondes.
//
// Chaque appel API relisait l'utilisateur puis son equipe: deux allers-retours
// base avant meme de traiter la requete, soit l'essentiel du temps des petites
// pages. Une page lance 2 a 4 appels en parallele, tous pour le meme compte.
//
// On stocke la promesse, pas le resultat: des appels simultanes partagent la
// meme requete en vol au lieu d'en lancer chacun une.
//
// Toute action qui change un compte (suspension, KYC, equipe, profil) appelle
// clearAuthCache(): l'effet reste immediat sur cette instance. Le delai ne
// joue que si plusieurs instances tournaient en parallele.
const AUTH_CACHE_TTL_MS = 30 * 1000;
const authCache = new Map();

const AUTH_SELECT =
  'id, email, role, is_active, kyc_status, email_verified_at, ' +
  'membership:team_members!team_members_member_id_fkey(' +
  'owner_id, owner:users!team_members_owner_id_fkey(kyc_status))';

async function fetchAuthContext(userId) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(AUTH_SELECT)
    .eq('id', userId)
    .single();

  if (error || !user) {
    return { user: null, error };
  }

  // Proprietaire effectif: le compte dont on manipule les donnees.
  // Soi-meme pour un promoteur, l'inviteur pour un membre d'equipe.
  // Jamais mis dans le jeton: une invitation peut etre revoquee.
  const { membership, ...fields } = user;

  return {
    user: {
      ...fields,
      ownerId: membership?.owner_id || user.id,
      isMember: Boolean(membership),
      // Le KYC porte sur le proprietaire, jamais sur le membre qui agit:
      // c'est l'argent du tenant qui sort.
      ownerKycStatus: membership
        ? membership.owner?.kyc_status || 'none'
        : user.kyc_status
    }
  };
}

function loadAuthContext(userId) {
  const cached = authCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.promise;
  }

  const promise = fetchAuthContext(userId);
  authCache.set(userId, { promise, expires: Date.now() + AUTH_CACHE_TTL_MS });

  // Un echec ne doit pas rester en cache 30 secondes
  promise
    .then((result) => {
      if (!result.user) authCache.delete(userId);
    })
    .catch(() => authCache.delete(userId));

  return promise;
}

/**
 * Vide le cache d'authentification. A appeler apres toute modification d'un
 * compte ou d'une equipe. On vide tout plutot qu'une entree: changer le KYC
 * d'un proprietaire doit aussi rafraichir ses membres.
 */
function clearAuthCache() {
  authCache.clear();
}

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
    
    // L'utilisateur, son equipe et le KYC du proprietaire en une seule requete
    const { user, error } = await loadAuthContext(decoded.userId);

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

    // Copie: l'objet en cache est partage entre requetes, aucun controleur
    // ne doit pouvoir le modifier pour les suivantes.
    req.user = { ...user };

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
  requireSuperAdmin,
  clearAuthCache
};

