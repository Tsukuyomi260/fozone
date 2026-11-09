/**
 * Routes principales de l'API
 * Centralise toutes les routes de l'application
 */

const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('./auth');
const wifiZoneRoutes = require('./wifiZones');
const pricingRoutes = require('./pricings');
const ticketRoutes = require('./tickets');
const paymentRoutes = require('./payments');
const dashboardRoutes = require('./dashboard');
const accountingRoutes = require('./accounting');
const walletRoutes = require('./wallet');
const adminRoutes = require('./admin');
const teamRoutes = require('./team');
const ebookWebhookRoutes = require('./ebookWebhook');
const ebookAdminRoutes = require('./ebookAdmin');

// Montage des routes
router.use('/auth', authRoutes);
router.use('/wifi-zones', wifiZoneRoutes);
router.use('/pricings', pricingRoutes);
router.use('/tickets', ticketRoutes);
router.use('/payments', paymentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/accounting', accountingRoutes);
router.use('/wallet', walletRoutes);
router.use('/admin', adminRoutes);
router.use('/team', teamRoutes);
// Generation des acces au guide. Le service du guide lui-meme est
// monte a part, sur /guide, hors de /api.
// Le webhook Chariow passe en premier : il est public, alors que le
// routeur d'administration qui suit exige une authentification.
router.use('/ebook', ebookWebhookRoutes);
router.use('/ebook', ebookAdminRoutes);

// Route de santé de l'API
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'fo-zone-api'
  });
});

module.exports = router;

