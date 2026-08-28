/**
 * Contrôleur d'authentification
 * Gère l'inscription, la connexion et la gestion des sessions
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

/**
 * Inscription d'un nouvel utilisateur
 */
async function register(req, res, next) {
  try {
    const { email, password, full_name } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur dans Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });

    if (authError) {
      logger.error('Error creating auth user:', authError);
      return res.status(400).json({
        error: 'Failed to create user account'
      });
    }

    // Créer l'utilisateur dans la table users
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: email,
        password_hash: hashedPassword,
        full_name: full_name || null,
        role: 'admin', // Tout nouveau compte est un promoteur
        // Inactif tant que le super-admin ne l'a pas approuve: la plateforme
        // detient les fonds encaisses, on ne laisse pas un inconnu vendre
        // avant verification.
        is_active: false
      })
      .select()
      .single();

    if (userError) {
      logger.error('Error creating user record:', userError);
      return res.status(400).json({
        error: 'Failed to create user record'
      });
    }

    // Aucun jeton n'est delivre: le compte est inactif, le middleware le
    // rejetterait a la premiere requete. Mieux vaut un message clair qu'une
    // session qui echoue partout.
    logger.info(`New user registered, pending approval: ${user.email}`);

    res.status(201).json({
      message: 'Compte créé. Il sera actif après validation par Fô-Zône.',
      pending_approval: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Connexion d'un utilisateur
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Récupérer l'utilisateur
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role, is_active, full_name')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Votre compte est en attente de validation par Fô-Zône.'
      });
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      token: token
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les informations de l'utilisateur connecté
 */
async function getProfile(req, res, next) {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, role, created_at')
      .eq('id', req.user.id)
      .single();

    // Distinguer une vraie absence d'un echec de requete: confondre les deux
    // a masque pendant longtemps une colonne manquante derriere un 404.
    if (error) {
      logger.error('Error loading profile:', { userId: req.user.id, error });
      return res.status(500).json({
        error: 'Failed to load profile',
        details: error.message
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour le profil de l'utilisateur
 */
async function updateProfile(req, res, next) {
  try {
    const { full_name, email, phone } = req.body;
    const userId = req.user.id;

    // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
    if (email) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({
          error: 'Email already in use'
        });
      }
    }

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name?.trim() || null;
    if (email !== undefined) updateData.email = email.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, full_name, phone, role, created_at')
      .single();

    if (error) {
      logger.error('Error updating profile:', error);
      return res.status(400).json({
        error: 'Failed to update profile',
        details: error.message
      });
    }

    logger.info(`Profile updated for user ${userId}`);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change le mot de passe de l'utilisateur
 */
async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long'
      });
    }

    // Récupérer l'utilisateur avec le mot de passe hashé
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Vérifier le mot de passe actuel
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', userId);

    if (updateError) {
      logger.error('Error changing password:', updateError);
      return res.status(400).json({
        error: 'Failed to change password',
        details: updateError.message
      });
    }

    logger.info(`Password changed for user ${userId}`);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};

