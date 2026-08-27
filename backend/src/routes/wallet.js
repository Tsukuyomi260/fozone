/**
 * Routes solde et retraits, cote promoteur
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const walletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validator');

// Tout ici est authentifie: un promoteur ne voit que son propre solde
router.use(authenticateToken);

const withdrawalValidation = [
  body('amount').isFloat({ gt: 0 }).withMessage('Le montant doit être supérieur à 0'),
  body('payout_phone')
    .trim()
    .isLength({ min: 8, max: 20 })
    .withMessage('Numéro de téléphone invalide')
];

router.get('/balance', walletController.getWalletBalance);
router.get('/withdrawals', walletController.getMyWithdrawals);
router.post('/withdrawals', withdrawalValidation, validate, walletController.requestWithdrawal);

module.exports = router;
