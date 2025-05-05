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
/**
 * Get daily shift statistics
 * @route GET /api/shifts/stats/daily
 * @access Private
 */
exports.getDailyStats = async (req, res) => {
    try {
      const date = req.query.date ? new Date(req.query.date) : new Date();
      
      // Set time to beginning of the day
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      // Set time to end of the day
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      // Find shifts within the day
      const shifts = await Shift.find({
        userId: req.user.id,
        date: { $gte: startOfDay, $lte: endOfDay },
        shiftStatus: 'completed'
      });
      
      // Calculate statistics
      let totalHours = 0;
      let totalBreakMinutes = 0;
      
      shifts.forEach(shift => {
        // Calculate shift duration in hours
        if (shift.endTime && shift.startTime) {
          const shiftDuration = (shift.endTime.timestamp - shift.startTime.timestamp) / (1000 * 60 * 60); // Convert ms to hours
          totalHours += shiftDuration;
        }
        
        // Calculate break durations
        if (shift.breaks && shift.breaks.length > 0) {
          shift.breaks.forEach(breakItem => {
            if (breakItem.endTime && breakItem.startTime) {
              const breakDuration = (breakItem.endTime.timestamp - breakItem.startTime.timestamp) / (1000 * 60); // Convert ms to minutes
              totalBreakMinutes += breakDuration;
            }
          });
        }
      });
      
      res.json({
        date: startOfDay,
        totalShifts: shifts.length,
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalBreakMinutes: Math.round(totalBreakMinutes),
        shifts: shifts
      });
    } catch (error) {
      console.error('Get daily stats error:', error.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };
  
  /**
   * Get weekly shift statistics
   * @route GET /api/shifts/stats/weekly
   * @access Private
   */
  exports.getWeeklyStats = async (req, res) => {
    try {
      // Get start of week based on query param or default to current week
      let startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
      
      // Adjust to start of week (Sunday)
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      
      // End of week (Saturday)
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      
      // Find shifts within the week
      const shifts = await Shift.find({
        userId: req.user.id,
        date: { $gte: startDate, $lte: endDate },
        shiftStatus: 'completed'
      }).sort({ date: 1 });
      
      // Initialize daily stats
      const dailyStats = Array(7).fill().map((_, index) => {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + index);
        
        return {
          date: new Date(currentDate),
          dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index],
          totalHours: 0,
          totalBreakMinutes: 0,
          shiftsCount: 0
        };
      });
      
      // Calculate statistics
      let totalWeeklyHours = 0;
      let totalWeeklyBreakMinutes = 0;
      
      shifts.forEach(shift => {
        const shiftDate = new Date(shift.date);
        const dayIndex = shiftDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Calculate shift duration
        if (shift.endTime && shift.startTime) {
          const shiftDuration = (shift.endTime.timestamp - shift.startTime.timestamp) / (1000 * 60 * 60); // Convert ms to hours
          dailyStats[dayIndex].totalHours += shiftDuration;
          totalWeeklyHours += shiftDuration;
          dailyStats[dayIndex].shiftsCount++;
        }
        
        // Calculate break durations
        if (shift.breaks && shift.breaks.length > 0) {
          shift.breaks.forEach(breakItem => {
            if (breakItem.endTime && breakItem.startTime) {
              const breakDuration = (breakItem.endTime.timestamp - breakItem.startTime.timestamp) / (1000 * 60); // Convert ms to minutes
              dailyStats[dayIndex].totalBreakMinutes += breakDuration;
              totalWeeklyBreakMinutes += breakDuration;
            }
          });
        }
      });
      
      // Format the results
      dailyStats.forEach(day => {
        day.totalHours = parseFloat(day.totalHours.toFixed(2));
        day.totalBreakMinutes = Math.round(day.totalBreakMinutes);
      });
      
      res.json({
        weekStart: startDate,
        weekEnd: endDate,
        totalShifts: shifts.length,
        totalHours: parseFloat(totalWeeklyHours.toFixed(2)),
        totalBreakMinutes: Math.round(totalWeeklyBreakMinutes),
        dailyStats: dailyStats
      });
    } catch (error) {
      console.error('Get weekly stats error:', error.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };
  
  /**
   * Get monthly shift statistics
   * @route GET /api/shifts/stats/monthly
   * @access Private
   */
  exports.getMonthlyStats = async (req, res) => {
    try {
      // Get month based on query param or default to current month
      let date = req.query.date ? new Date(req.query.date) : new Date();
      
      // Start of month
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      
      // End of month
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Find shifts within the month
      const shifts = await Shift.find({
        userId: req.user.id,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        shiftStatus: 'completed'
      }).sort({ date: 1 });
      
      // Calculate statistics
      let totalHours = 0;
      let totalBreakMinutes = 0;
      let weeklyStats = {};
      
      shifts.forEach(shift => {
        // Calculate shift duration
        if (shift.endTime && shift.startTime) {
          const shiftDuration = (shift.endTime.timestamp - shift.startTime.timestamp) / (1000 * 60 * 60); // Convert ms to hours
          totalHours += shiftDuration;
          
          // Group by week
          const weekNumber = getWeekNumber(shift.date);
          if (!weeklyStats[weekNumber]) {
            weeklyStats[weekNumber] = {
              hours: 0,
              breaks: 0,
              shifts: 0
            };
          }
          
          weeklyStats[weekNumber].hours += shiftDuration;
          weeklyStats[weekNumber].shifts++;
        }
        
        // Calculate break durations
        if (shift.breaks && shift.breaks.length > 0) {
          shift.breaks.forEach(breakItem => {
            if (breakItem.endTime && breakItem.startTime) {
              const breakDuration = (breakItem.endTime.timestamp - breakItem.startTime.timestamp) / (1000 * 60); // Convert ms to minutes
              totalBreakMinutes += breakDuration;
              
              const weekNumber = getWeekNumber(shift.date);
              if (weeklyStats[weekNumber]) {
                weeklyStats[weekNumber].breaks += breakDuration;
              }
            }
          });
        }
      });
      
      // Format weekly stats array
      const formattedWeeklyStats = Object.keys(weeklyStats).map(week => {
        return {
          weekNumber: parseInt(week),
          totalHours: parseFloat(weeklyStats[week].hours.toFixed(2)),
          totalBreakMinutes: Math.round(weeklyStats[week].breaks),
          shiftsCount: weeklyStats[week].shifts
        };
      });
      
      res.json({
        month: date.getMonth() + 1, // 1-12
        year: date.getFullYear(),
        totalShifts: shifts.length,
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalBreakMinutes: Math.round(totalBreakMinutes),
        weeklyStats: formattedWeeklyStats
      });
    } catch (error) {
      console.error('Get monthly stats error:', error.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };
  
  /**
   * Get all shifts for logged-in user with pagination
   * @route GET /api/shifts
   * @access Private
   */
  exports.getUserShifts = async (req, res) => {
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
      
      // Status filter
      if (req.query.status) {
        query.shiftStatus = req.query.status;
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
      console.error('Get user shifts error:', error.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };
  
  /**
   * Update shift (admin or own shift only)
   * @route PUT /api/shifts/:id
   * @access Private
   */
  exports.updateShift = async (req, res) => {
    try {
      const { id } = req.params;
      const { notes, startTime, endTime, breaks } = req.body;
      
      // Find shift
      const shift = await Shift.findById(id);
      
      if (!shift) {
        return res.status(404).json({ msg: 'Shift not found' });
      }
      
      // Check user permission (must be shift owner or admin)
      if (shift.userId.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Not authorized to update this shift' });
      }
      
      // Update fields if provided
      if (notes !== undefined) shift.notes = notes;
      
      // Only admin can update time fields
      if (req.user.role === 'admin') {
        if (startTime) {
          shift.startTime.timestamp = new Date(startTime);
        }
        
        if (endTime) {
          shift.endTime = {
            timestamp: new Date(endTime),
            location: shift.endTime ? shift.endTime.location : shift.startTime.location
          };
          
          // If setting end time, ensure status is completed
          if (!shift.endTime) {
            shift.shiftStatus = 'completed';
          }
        }
        
        // Update breaks if provided
        if (breaks) {
          shift.breaks = breaks;
        }
        
        // Recalculate durations
        if (shift.endTime && shift.startTime) {
          shift.duration = (shift.endTime.timestamp - shift.startTime.timestamp) / (1000 * 60 * 60); // hours
        }
      }
      
      await shift.save();
      
      res.json({
        msg: 'Shift updated successfully',
        shift
      });
    } catch (error) {
      console.error('Update shift error:', error.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };
  
  /**
   * Delete shift (admin only)
   * @route DELETE /api/shifts/:id
   * @access Private (Admin)
   */
  exports.deleteShift = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Only admin can delete shifts
      if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Not authorized to delete shifts' });
      }
      
      const shift = await Shift.findById(id);
      
      if (!shift) {
        return res.status(404).json({ msg: 'Shift not found' });
      }
      
      await shift.remove();
      
      res.json({ msg: 'Shift deleted successfully' });
    } catch (error) {
      console.error('Delete shift error:', error.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };
  
  // Helper function for monthly stats
  function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Set to nearest Thursday
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }