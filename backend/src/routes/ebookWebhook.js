/**
 * Webhook Chariow.
 *
 * Monte sur /ebook AVANT le routeur d'administration, qui impose une
 * authentification : Chariow n'a pas de compte chez nous. La route est donc
 * publique, et protegee par la signature HMAC du corps brut.
 *
 * Pas de limiteur de debit ici : Chariow reessaie une vente jusqu'a cinq fois,
 * et bloquer un reessai legitime couterait une livraison.
 */

const express = require('express');
const router = express.Router();
const { recevoirVente } = require('../controllers/chariowController');

router.post('/chariow', recevoirVente);

module.exports = router;
