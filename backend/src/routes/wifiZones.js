/**
 * Routes pour la gestion des zones Wi-Fi
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const wifiZoneController = require('../controllers/wifiZoneController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validator');
const { COUNTRIES } = require('../config/countries');

const SUPPORTED_COUNTRIES = Object.keys(COUNTRIES);

// Validation pour la création/mise à jour
const zoneValidation = [
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('router_ip').trim().isLength({ min: 1, max: 255 }), // Accepte IP, DNS ou VPN
  body('manager_phone').trim().isLength({ min: 8, max: 20 }),
  body('country').optional().isIn(SUPPORTED_COUNTRIES),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('address').optional().trim()
];

const zoneIdValidation = [
  param('id').isUUID()
];

// Route publique pour récupérer les infos publiques d'une zone (pour les clients)
router.get('/public/:id', zoneIdValidation, validate, wifiZoneController.getPublicZoneById);

// Routes protégées (nécessitent authentification)
router.use(authenticateToken);

router.get('/', wifiZoneController.getAllZones);
router.get('/:id', zoneIdValidation, validate, wifiZoneController.getZoneById);
router.post('/', zoneValidation, validate, wifiZoneController.createZone);
router.put('/:id', zoneIdValidation, zoneValidation, validate, wifiZoneController.updateZone);
router.delete('/:id', zoneIdValidation, validate, wifiZoneController.deleteZone);

module.exports = router;

