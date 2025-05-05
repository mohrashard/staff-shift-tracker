const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const auth = require('../middleware/auth');
const { validateLocation } = require('../middleware/validators');

/**
 * @route   POST /api/shifts/start
 * @desc    Start a new shift with location
 * @access  Private
 */
router.post('/start', auth, validateLocation, shiftController.startShift);

/**
 * @route   POST /api/shifts/end
 * @desc    End current shift with location
 * @access  Private
 */
router.post('/end', auth, validateLocation, shiftController.endShift);

/**
 * @route   POST /api/shifts/break/start
 * @desc    Start break on current shift with location
 * @access  Private
 */
router.post('/break/start', auth, validateLocation, shiftController.startBreak);

/**
 * @route   POST /api/shifts/break/end
 * @desc    End break on current shift with location
 * @access  Private
 */
router.post('/break/end', auth, validateLocation, shiftController.endBreak);
// Move these specific routes BEFORE the /:id route
/**
 * @route   GET /api/shifts/stats/daily
 * @desc    Get daily shift statistics for logged-in user
 * @access  Private
 */
router.get('/stats/daily', auth, shiftController.getDailyStats);

/**
 * @route   GET /api/shifts/stats/weekly
 * @desc    Get weekly shift statistics for logged-in user
 * @access  Private
 */
router.get('/stats/weekly', auth, shiftController.getWeeklyStats);

/**
 * @route   GET /api/shifts/stats/monthly
 * @desc    Get monthly shift statistics for logged-in user
 * @access  Private
 */
router.get('/stats/monthly', auth, shiftController.getMonthlyStats);

// Then define the wildcard/parameter routes after
/**
 * @route   GET /api/shifts/:id
 * @desc    Get shift by ID
 * @access  Private
 */
router.get('/:id', auth, shiftController.getShiftById);

module.exports = router;