/**
 * Generation et suivi des acces au guide.
 * Double barriere, comme les routes d'administration : authentifie, puis
 * role super_admin obligatoire.
 *
 * A ne pas confondre avec routes/ebook.js, qui sert le guide aux acheteurs
 * et qui est volontairement ouvert, protege par le jeton et le mot de passe.
 */

const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const ebookAdmin = require('../controllers/ebookAdminController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const validate = require('../middleware/validator');

router.use(authenticateToken);
router.use(requireSuperAdmin);

const idValidation = [param('id').isUUID()];

router.get('/licences', ebookAdmin.listerLicences);

router.post(
  '/licences',
  [
    body('prenom').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
    body('nom').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
    body('telephone').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
    body('pays').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 2 }),
    body('montant').optional({ nullable: true }),
    body('provenance').optional({ checkFalsy: true }).trim(),
    body('note').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('max_appareils').optional({ checkFalsy: true }).isInt({ min: 1, max: 10 })
  ],
  validate,
  ebookAdmin.creerLicence
);

router.get('/licences/:id/appareils', idValidation, validate, ebookAdmin.listerAppareils);
router.post('/licences/:id/liberer', idValidation, validate, ebookAdmin.libererAppareils);
router.post('/licences/:id/regenerer', idValidation, validate, ebookAdmin.regenererLicence);
router.post('/licences/:id/oublier-mot-de-passe', idValidation, validate, ebookAdmin.oublierMotDePasse);

router.post(
  '/licences/:id/revoquer',
  idValidation,
  [body('motif').optional({ checkFalsy: true }).trim().isLength({ max: 500 })],
  validate,
  ebookAdmin.revoquerLicence
);

module.exports = router;
