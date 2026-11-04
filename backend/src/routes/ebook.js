/**
 * Acces au guide, par jeton puis par mot de passe.
 *
 * Monte sur /guide, hors de /api: l'acheteur ouvre une page, pas une API.
 * Cela le tient aussi a l'ecart du limiteur de debit pose sur /api.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { servirGuide, ouvrirGuide } = require('../controllers/ebookController');

const router = express.Router();

/**
 * Un lecteur ouvre son guide quelques fois par jour. Cent ouvertures par heure
 * et par adresse laissent toute la marge necessaire, tout en coupant court a
 * qui essaierait des jetons au hasard.
 */
const limiteurLecture = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives. Reessaie dans une heure.'
});

/**
 * Le mot de passe, lui, se tente. Dix essais par heure et par adresse: un
 * acheteur qui hesite sur le sien a largement de quoi, une machine qui les
 * enumere n'arrive nulle part.
 */
const limiteurMotDePasse = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop d\'essais de mot de passe. Reessaie dans une heure.'
});

router.get('/:jeton', limiteurLecture, servirGuide);
router.post('/:jeton', limiteurMotDePasse, ouvrirGuide);

module.exports = router;
