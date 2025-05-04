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

/**
 * @route   GET /api/shifts/current
 * @desc    Get current shift status for logged-in user
 * @access  Private
 */
router.get('/current', auth, shiftController.getCurrentShift);

/**
 * @route   GET /api/shifts
 * @desc    Get all shifts for logged-in user with pagination
 * @access  Private
 */
router.get('/', auth, shiftController.getUserShifts);

/**
 * @route   GET /api/shifts/:id
 * @desc    Get shift by ID
 * @access  Private
 */
router.get('/:id', auth, shiftController.getShiftById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Update shift (admin or own shift only)
 * @access  Private
 */
router.put('/:id', auth, shiftController.updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Delete shift (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', auth, shiftController.deleteShift);

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

module.exports = router;