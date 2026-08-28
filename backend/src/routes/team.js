/**
 * Routes de gestion d'equipe (cote promoteur)
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const teamController = require('../controllers/teamController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validator');

router.use(authenticateToken);

const addValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').optional({ checkFalsy: true }).isLength({ min: 6 }),
  body('full_name').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 255 })
];

router.get('/', teamController.getTeam);
router.post('/', addValidation, validate, teamController.addMember);
router.delete('/:id', [param('id').isUUID()], validate, teamController.removeMember);

module.exports = router;
