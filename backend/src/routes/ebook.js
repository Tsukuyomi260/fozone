/**
 * Acces public au guide, par jeton.
 *
 * Monte sur /guide, hors de /api: l'acheteur ouvre une page, pas une API.
 * Cela le tient aussi a l'ecart du limiteur de debit pose sur /api.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { servirGuide } = require('../controllers/ebookController');

const router = express.Router();

/**
 * Un lecteur ouvre son guide quelques fois par jour. Cent requetes par heure
 * et par adresse laissent toute la marge necessaire, tout en coupant court a
 * qui essaierait des jetons au hasard.
 */
const limiteur = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives. Reessaie dans une heure.'
});

router.get('/:jeton', limiteur, servirGuide);

module.exports = router;
