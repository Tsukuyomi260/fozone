/**
 * Routes d'administration de la plateforme.
 * Double barriere: authentifie, puis role super_admin obligatoire.
 */

const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const validate = require('../middleware/validator');

router.use(authenticateToken);
router.use(requireSuperAdmin);

const idValidation = [param('id').isUUID()];
const noteValidation = [body('note').optional().trim().isLength({ max: 500 })];

router.get('/tenants', adminController.getTenants);
router.get('/withdrawals', adminController.getWithdrawals);

router.put('/withdrawals/:id/approve', idValidation, noteValidation, validate, adminController.approveWithdrawal);
router.put('/withdrawals/:id/paid', idValidation, noteValidation, validate, adminController.markWithdrawalPaid);
router.put('/withdrawals/:id/reject', idValidation, noteValidation, validate, adminController.rejectWithdrawal);

module.exports = router;
