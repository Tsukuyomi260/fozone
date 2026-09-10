/**
 * Routes pour la gestion des tickets
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { param, query, body } = require('express-validator');
const ticketController = require('../controllers/ticketController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validator');

// Configuration Multer pour l'upload de fichiers CSV en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

const zoneIdValidation = [
  param('zoneId').isUUID()
];

router.use(authenticateToken);

// Tarifs bientot en rupture, toutes zones confondues. Avant /:ticketId,
// sinon 'alerts' serait pris pour un identifiant de ticket.
router.get('/alerts', ticketController.getStockAlerts);

// Rattache un profil MikroTik a un tarif, pour le stock encore invendable
router.put(
  '/zone/:zoneId/link-profile',
  zoneIdValidation,
  [
    body('pricing_id').isUUID(),
    body('profile').optional({ nullable: true }).trim().isLength({ max: 255 })
  ],
  validate,
  ticketController.linkProfileToPricing
);

// Routes spécifiques pour un ticket (doivent être définies AVANT les routes /zone/:zoneId)
const ticketIdValidation = [
  param('ticketId').isUUID()
];

router.delete('/:ticketId', 
  ticketIdValidation, 
  validate, 
  ticketController.deleteTicket
);

// Routes pour les zones
router.get('/zone/:zoneId', 
  zoneIdValidation, 
  [query('status').optional().isIn(['free', 'reserved', 'sold', 'expired']),
   query('pricing_id').optional().isUUID(),
   query('page').optional().isInt({ min: 1 }),
   query('limit').optional().isInt({ min: 1, max: 100 })],
  validate, 
  ticketController.getTicketsByZone
);

router.post('/zone/:zoneId/import', 
  zoneIdValidation, 
  validate,
  upload.single('csv'),
  ticketController.importTickets
);

router.get('/zone/:zoneId/stats', 
  zoneIdValidation, 
  validate, 
  ticketController.getTicketStats
);

router.delete('/zone/:zoneId/all', 
  zoneIdValidation, 
  validate, 
  ticketController.deleteAllTickets
);

module.exports = router;

