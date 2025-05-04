const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

/**
 * All routes in this file require both authentication and admin privileges
 * The admin middleware checks if the authenticated user has admin role
 */

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination
 * @access  Private (Admin only)
 */
router.get('/users', auth, admin, adminController.getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get('/users/:id', auth, admin, adminController.getUserById);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user (admin only)
 * @access  Private (Admin only)
 */
router.put('/users/:id', auth, admin, adminController.updateUser);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user (admin only)
 * @access  Private (Admin only)
 */
router.delete('/users/:id', auth, admin, adminController.deleteUser);

/**
 * @route   GET /api/admin/shifts
 * @desc    Get all shifts with filtering options
 * @access  Private (Admin only)
 */
router.get('/shifts', auth, admin, adminController.getAllShifts);

/**
 * @route   GET /api/admin/shifts/user/:userId
 * @desc    Get all shifts for a specific user
 * @access  Private (Admin only)
 */
router.get('/shifts/user/:userId', auth, admin, adminController.getUserShifts);

/**
 * @route   PUT /api/admin/shifts/:id
 * @desc    Update any shift (admin override)
 * @access  Private (Admin only)
 */
router.put('/shifts/:id', auth, admin, adminController.updateShift);

/**
 * @route   GET /api/admin/stats/overview
 * @desc    Get company-wide statistics
 * @access  Private (Admin only)
 */
router.get('/stats/overview', auth, admin, adminController.getCompanyStats);

/**
 * @route   GET /api/admin/stats/department
 * @desc    Get department-based statistics
 * @access  Private (Admin only)
 */
router.get('/stats/department', auth, admin, adminController.getDepartmentStats);

/**
 * @route   GET /api/admin/export/shifts
 * @desc    Export shifts data (CSV, Excel, PDF)
 * @access  Private (Admin only)
 */
router.get('/export/shifts', auth, admin, adminController.exportShifts);

/**
 * @route   GET /api/admin/reports/attendance
 * @desc    Generate attendance reports
 * @access  Private (Admin only)
 */
router.get('/reports/attendance', auth, admin, adminController.generateAttendanceReport);

/**
 * @route   GET /api/admin/reports/overtime
 * @desc    Generate overtime reports
 * @access  Private (Admin only)
 */
router.get('/reports/overtime', auth, admin, adminController.generateOvertimeReport);

/**
 * @route   POST /api/admin/notifications
 * @desc    Send notification to users
 * @access  Private (Admin only)
 */
router.post('/notifications', auth, admin, adminController.sendNotification);

/**
 * @route   GET /api/admin/logs
 * @desc    Get system logs
 * @access  Private (Admin only)
 */
router.get('/logs', auth, admin, adminController.getSystemLogs);

module.exports = router;