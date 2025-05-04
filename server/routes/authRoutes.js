const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateSignup, validateLogin } = require('../middleware/validators');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validateSignup, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify user token
 * @access  Private
 */
router.get('/verify', auth, authController.verifyToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user / Invalidate token
 * @access  Private
 */
router.post('/logout', auth, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user's data
 * @access  Private
 */
router.get('/me', auth, authController.getCurrentUser);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Public (with refresh token)
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;