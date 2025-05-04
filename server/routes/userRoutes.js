const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { validateUserUpdate } = require('../middleware/validators');

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', auth, userController.getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', auth, validateUserUpdate, userController.updateUserProfile);

/**
 * @route   PUT /api/users/password
 * @desc    Update password
 * @access  Private
 */
router.put('/password', auth, userController.updatePassword);

/**
 * @route   GET /api/users/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/notifications', auth, userController.getNotifications);

/**
 * @route   PUT /api/users/notifications/:id
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/notifications/:id', auth, userController.markNotificationRead);

/**
 * @route   GET /api/users/dashboard
 * @desc    Get user dashboard data
 * @access  Private
 */
router.get('/dashboard', auth, userController.getDashboardData);

/**
 * @route   POST /api/users/profile/avatar
 * @desc    Upload profile avatar
 * @access  Private
 */
router.post('/profile/avatar', auth, userController.uploadAvatar);

/**
 * @route   DELETE /api/users/profile/avatar
 * @desc    Delete profile avatar
 * @access  Private
 */
router.delete('/profile/avatar', auth, userController.deleteAvatar);

/**
 * @route   GET /api/users/settings
 * @desc    Get user settings
 * @access  Private
 */
router.get('/settings', auth, userController.getUserSettings);

/**
 * @route   PUT /api/users/settings
 * @desc    Update user settings
 * @access  Private
 */
router.put('/settings', auth, userController.updateUserSettings);

module.exports = router;