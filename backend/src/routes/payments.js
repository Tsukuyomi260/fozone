/**
 * Routes pour la gestion des paiements
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validator');

// Validation pour la création de paiement (route publique)
// pricing_id est obligatoire: le montant est lu en base a partir du tarif.
// Accepter un montant fourni par le client laisserait choisir son propre prix.
const paymentIntentValidation = [
  body('wifi_zone_id').isUUID(),
  body('pricing_id').isUUID(),
  body('customer').isObject(),
  body('customer.phone').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 8, max: 20 }),
  body('customer.email').optional().isEmail(),
  body('customer.first_name').optional().trim(),
  body('customer.last_name').optional().trim()
];

const paymentIdValidation = [
  // Accepter soit un UUID (pour les routes admin), soit un ID Moneroo (py_xxx ou test_xxx)
  param('paymentId').custom((value) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const isMonerooId = /^(py_|test_)[a-z0-9]+$/i.test(value);
    if (!isUUID && !isMonerooId) {
      throw new Error('Invalid payment ID format');
    }
    return true;
  })
];

const zoneIdValidation = [
  param('zoneId').isUUID()
];

// Route publique pour créer un paiement (appelée depuis le portail captif)
router.post('/intent', paymentIntentValidation, validate, paymentController.createPaymentIntent);

// Route publique pour le webhook Moneroo (sécurisée par signature)
router.post('/moneroo/webhook', paymentController.handleMonerooWebhook);

// Route publique pour vérifier le statut d'un paiement (pour le client)
router.get('/:paymentId', paymentIdValidation, validate, paymentController.getPaymentStatus);

// Routes protégées pour l'admin
router.use(authenticateToken);

router.get('/zone/:zoneId', 
  zoneIdValidation,
  [query('status').optional().isIn(['pending', 'completed', 'failed']),
   query('page').optional().isInt({ min: 1 }),
   query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  paymentController.getPaymentsByZone
);

module.exports = router;

