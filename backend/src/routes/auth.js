/**
 * Routes d'authentification
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validator');

// Validation pour l'inscription
// Chaque regle porte son message: le client n'affiche que le premier, il doit
// donc dire quel champ corriger. Un " Validation failed " brut ne renseigne
// personne et laisse l'inscrit devant un mur.
const registerValidation = [
  // trim avant isEmail: une adresse copiee-collee traine souvent une espace,
  // et isEmail la refuse sans rien expliquer.
  body('email')
    .trim()
    .isEmail().withMessage('Adresse e-mail invalide')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  // checkFalsy: un nom laisse vide est un champ absent, pas un champ invalide
  body('full_name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2 })
    .withMessage('Le nom doit contenir au moins 2 caractères')
];

// Validation pour la connexion
const loginValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Adresse e-mail invalide')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Mot de passe requis')
];

router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);

router.use(authenticateToken);

router.get('/profile', authController.getProfile);
router.put('/profile', 
  [body('full_name').optional().trim().isLength({ min: 2, max: 255 }),
   body('email').optional().isEmail().normalizeEmail(),
   body('phone').optional().trim().isLength({ min: 8, max: 20 }).withMessage('Le numéro de téléphone doit contenir entre 8 et 20 caractères')],
  validate,
  authController.updateProfile
);
router.put('/profile/password',
  [body('current_password').notEmpty().withMessage('Le mot de passe actuel est requis'),
   body('new_password').isLength({ min: 6 }).withMessage('Le nouveau mot de passe doit contenir au moins 6 caractères')],
  validate,
  authController.changePassword
);

module.exports = router;

