/**
 * Routes pour la comptabilité
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const accountingController = require('../controllers/accountingController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validator');

router.use(authenticateToken);

// Statistiques de paiements (pour graphiques)
router.get('/payment-stats',
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('period').optional().isIn(['days', 'weeks', 'months'])
  ],
  validate,
  accountingController.getPaymentStats
);

// Statistiques de tickets vendus (pour graphiques)
router.get('/tickets-sold-stats',
  [
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('period').optional().isIn(['days', 'weeks', 'months'])
  ],
  validate,
  accountingController.getTicketsSoldStats
);

// Repartition par moyen de paiement (pour le graphique)
router.get('/payment-methods',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('zoneId').optional().isUUID()
  ],
  validate,
  accountingController.getPaymentMethodStats
);

// Historique des paiements
router.get('/payment-history',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('zoneId').optional().isUUID(),
    query('search').optional().trim()
  ],
  validate,
  accountingController.getPaymentHistory
);

// Export CSV
router.get('/export-csv',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('zoneId').optional().isUUID()
  ],
  validate,
  accountingController.exportPaymentHistoryCSV
);

module.exports = router;

