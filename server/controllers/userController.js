const User = require('../models/user');
const Shift = require('../models/shift');
const Notification = require('../models/notification');
const { validationResult } = require('express-validator');

/**
 * Get user profile
 * @route GET /api/user/profile
 * @access Private
 */
exports.getUserProfile = async (req, res) => {
  try {
    // Find user without password field
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user profile error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Update user profile
 * @route PUT /api/user/profile
 * @access Private
 */
exports.updateProfile = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { firstName, lastName, department, position, profilePicture } = req.body;
    
    // Build update object
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (department) updateFields.department = department;
    if (position) updateFields.position = position;
    if (profilePicture) updateFields.profilePicture = profilePicture;
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json({
      msg: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get user statistics
 * @route GET /api/user/statistics
 * @access Private
 */
exports.getUserStatistics = async (req, res) => {
  try {
    // Timeframe parameters
    const { timeframe = 'week' } = req.query; // 'day', 'week', 'month'
    
    // Calculate date range based on timeframe
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case 'day':
        startDate.setHours(0, 0, 0, 0); // Start of today
        break;
      case 'week':
        // Start of current week (Sunday)
        const day = startDate.getDay(); // 0 is Sunday
        startDate.setDate(startDate.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        // Start of current month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7); // Default to 7 days
    }
    
    // Find completed shifts in the date range
    const shifts = await Shift.find({
      userId: req.user.id,
      shiftStatus: 'completed',
      date: { $gte: startDate, $lte: endDate }
    });
    
    // Calculate statistics
    const totalShifts = shifts.length;
    let totalWorkMinutes = 0;
    let totalBreakMinutes = 0;
    let longestShift = 0;
    
    shifts.forEach(shift => {
      totalWorkMinutes += shift.totalWorkDuration;
      totalBreakMinutes += shift.totalBreakDuration;
      
      if (shift.totalWorkDuration > longestShift) {
        longestShift = shift.totalWorkDuration;
      }
    });
    
    // Convert minutes to hours for better readability
    const stats = {
      totalShifts,
      totalWorkHours: (totalWorkMinutes / 60).toFixed(2),
      totalBreakHours: (totalBreakMinutes / 60).toFixed(2),
      averageShiftLength: totalShifts > 0 ? ((totalWorkMinutes / totalShifts) / 60).toFixed(2) : 0,
      longestShiftHours: (longestShift / 60).toFixed(2),
      timeframe,
      startDate,
      endDate
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get user statistics error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get user notifications
 * @route GET /api/user/notifications
 * @access Private
 */
exports.getNotifications = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const unreadOnly = req.query.unread === 'true';
    
    // Build query
    const query = { userId: req.user.id };
    
    if (unreadOnly) {
      query.isRead = false;
    }
    
    // Execute query with pagination
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Notification.countDocuments(query);
    
    // Get unread count
    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });
    
    res.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Mark notification as read
 * @route PUT /api/user/notifications/:id
 * @access Private
 */
exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOne({
      _id: id,
      userId: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    
    notification.isRead = true;
    await notification.save();
    
    res.json({
      msg: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Mark notification read error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Mark all notifications as read
 * @route PUT /api/user/notifications/read-all
 * @access Private
 */
exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    
    res.json({ msg: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};