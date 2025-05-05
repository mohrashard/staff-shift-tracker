const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Updated routes to match controller methods
router.get('/employees', auth, admin, adminController.getAllEmployees);
router.get('/shifts', auth, admin, adminController.getAllShifts);
router.get('/shifts/:id', auth, admin, adminController.getShiftById);
router.put('/shifts/:id', auth, admin, adminController.updateShift);
router.delete('/shifts/:id', auth, admin, adminController.deleteShift);
router.get('/analytics', auth, admin, adminController.getAnalytics);
router.get('/export/csv', auth, admin, adminController.exportToCSV);
router.get('/export/excel', auth, admin, adminController.exportToExcel);
router.get('/export/pdf', auth, admin, adminController.exportToPDF);
router.get('/shifts/active', auth, admin, adminController.getActiveShifts);
router.get('/employees/:id/summary', auth, admin, adminController.getEmployeeSummary);
router.get('/departments/summary', auth, admin, adminController.getDepartmentSummary);
router.post('/shifts', auth, admin, adminController.addShift);

// Remove undefined routes:
// - /users routes (not implemented in controller)
// - /stats routes (implement analytics instead)
// - /reports routes (use export endpoints instead)
// - /notifications (not implemented)
// - /logs (not implemented)

module.exports = router;