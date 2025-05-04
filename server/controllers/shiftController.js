const Shift = require('../models/shift');
const User = require('../models/user');
const Notification = require('../models/notification');
const { validationResult } = require('express-validator');

/**
 * Start a new shift
 * @route POST /api/shifts/start
 * @access Private
 */
exports.startShift = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { latitude, longitude, address } = req.body;
    
    // Check if user already has an active shift
    const activeShift = await Shift.findOne({
      userId: req.user.id,
      shiftStatus: { $in: ['active', 'break'] }
    });
    
    if (activeShift) {
      return res.status(400).json({ 
        msg: 'You already have an active shift',
        shift: activeShift
      });
    }
    
    // Create new shift
    const newShift = new Shift({
      userId: req.user.id,
      date: new Date(),
      startTime: {
        timestamp: new Date(),
        location: {
          latitude,
          longitude,
          address: address || ''
        }
      }
    });
    
    // Save shift
    await newShift.save();
    
    res.status(201).json({
      msg: 'Shift started successfully',
      shift: newShift
    });
  } catch (error) {
    console.error('Start shift error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Start a break during shift
 * @route PUT /api/shifts/:id/break
 * @access Private
 */
exports.startBreak = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, latitude, longitude, address } = req.body;
    
    // Validate break type
    if (!['lunch', 'short'].includes(type)) {
      return res.status(400).json({ msg: 'Invalid break type' });
    }
    
    // Find shift
    const shift = await Shift.findOne({
      _id: id,
      userId: req.user.id,
      shiftStatus: 'active'
    });
    
    if (!shift) {
      return res.status(404).json({ msg: 'Active shift not found' });
    }
    
    // Start break
    const location = { latitude, longitude, address: address || '' };
    const newBreak = shift.startBreak(type, location);
    
    // Save shift
    await shift.save();
    
    res.json({
      msg: `${type} break started successfully`,
      shift,
      breakDetails: newBreak
    });
  } catch (error) {
    console.error('Start break error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * End current break
 * @route PUT /api/shifts/:id/break/end
 * @access Private
 */
exports.endBreak = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, address } = req.body;
    
    // Find shift
    const shift = await Shift.findOne({
      _id: id,
      userId: req.user.id,
      shiftStatus: 'break'
    });
    
    if (!shift) {
      return res.status(404).json({ msg: 'Shift on break not found' });
    }
    
    // End break
    const location = { latitude, longitude, address: address || '' };
    const updatedBreak = shift.endBreak(location);
    
    if (!updatedBreak) {
      return res.status(400).json({ msg: 'No active break found' });
    }
    
    // Save shift
    await shift.save();
    
    // Check if break exceeded recommended time and create notification if needed
    const breakDuration = updatedBreak.duration;
    const maxDuration = updatedBreak.type === 'lunch' ? 60 : 15; // Max minutes
    
    if (breakDuration > maxDuration) {
      const exceededBy = Math.round(breakDuration - maxDuration);
      await Notification.createBreakExceededNotification(
        req.user.id,
        updatedBreak.type,
        exceededBy
      );
    }
    
    res.json({
      msg: 'Break ended successfully',
      shift,
      breakDetails: updatedBreak
    });
  } catch (error) {
    console.error('End break error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * End current shift
 * @route PUT /api/shifts/:id/end
 * @access Private
 */
exports.endShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, address, notes } = req.body;
    
    // Find shift
    const shift = await Shift.findOne({
      _id: id,
      userId: req.user.id,
      shiftStatus: { $in: ['active', 'break'] }
    });
    
    if (!shift) {
      return res.status(404).json({ msg: 'Active shift not found' });
    }
    
    // End shift
    const location = { latitude, longitude, address: address || '' };
    shift.endShift(location);
    
    // Add notes if provided
    if (notes) {
      shift.notes = notes;
    }
    
    // Save shift
    await shift.save();
    
    // Create shift completion notification
    await Notification.createShiftCompleteNotification(req.user.id, shift);
    
    res.json({
      msg: 'Shift ended successfully',
      shift
    });
  } catch (error) {
    console.error('End shift error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get current shift for user
 * @route GET /api/shifts/current
 * @access Private
 */
exports.getCurrentShift = async (req, res) => {
  try {
    // Find current active or break shift
    const currentShift = await Shift.findOne({
      userId: req.user.id,
      shiftStatus: { $in: ['active', 'break'] }
    });
    
    if (!currentShift) {
      return res.json({ active: false });
    }
    
    res.json({
      active: true,
      shift: currentShift
    });
  } catch (error) {
    console.error('Get current shift error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get shift history for current user
 * @route GET /api/shifts/history
 * @access Private
 */
exports.getShiftHistory = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    
    // Build query
    const query = { userId: req.user.id };
    
    // Add date range if provided
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    } else if (endDate) {
      query.date = { $lte: endDate };
    }
    
    // Execute query with pagination
    const shifts = await Shift.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Shift.countDocuments(query);
    
    res.json({
      shifts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get shift history error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get shift details by ID
 * @route GET /api/shifts/:id
 * @access Private
 */
exports.getShiftById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const shift = await Shift.findOne({
      _id: id,
      userId: req.user.id
    });
    
    if (!shift) {
      return res.status(404).json({ msg: 'Shift not found' });
    }
    
    res.json(shift);
  } catch (error) {
    console.error('Get shift by ID error:', error.message);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Shift not found' });
    }
    
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Update shift notes
 * @route PUT /api/shifts/:id/notes
 * @access Private
 */
exports.updateShiftNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const shift = await Shift.findOne({
      _id: id,
      userId: req.user.id
    });
    
    if (!shift) {
      return res.status(404).json({ msg: 'Shift not found' });
    }
    
    shift.notes = notes;
    await shift.save();
    
    res.json({
      msg: 'Shift notes updated successfully',
      shift
    });
  } catch (error) {
    console.error('Update shift notes error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};