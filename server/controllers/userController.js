const User = require('../models/user');
const Shift = require('../models/shift');
const Notification = require('../models/notification');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

/**
 * Get user profile
 * @route GET /api/users/profile
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
 * @route PUT /api/users/profile
 * @access Private
 */
exports.updateUserProfile = async (req, res) => {
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
 * Update user password
 * @route PUT /api/users/password
 * @access Private
 */
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Please provide current and new passwords' });
    }
    
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Check if current password is correct
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ msg: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get user statistics
 * @route GET /api/users/statistics
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
 * @route GET /api/users/notifications
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
 * @route PUT /api/users/notifications/:id
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
 * @route PUT /api/users/notifications/read-all
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

/**
 * Get user dashboard data
 * @route GET /api/users/dashboard
 * @access Private
 */
exports.getDashboardData = async (req, res) => {
  try {
    // Get current date and beginning of day
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Find user
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Get current active shift if exists
    const activeShift = await Shift.findOne({
      userId: req.user.id,
      shiftStatus: { $in: ['active', 'break'] }
    });
    
    // Get today's completed shifts
    const todayShifts = await Shift.find({
      userId: req.user.id,
      date: { $gte: startOfDay, $lte: now },
      shiftStatus: 'completed'
    });
    
    // Calculate today's stats
    let todayWorkMinutes = 0;
    let todayBreakMinutes = 0;
    
    todayShifts.forEach(shift => {
      todayWorkMinutes += shift.totalWorkDuration;
      todayBreakMinutes += shift.totalBreakDuration;
    });
    
    // If there's an active shift, add its current duration
    let currentStatus = 'not_working';
    let currentShiftDuration = 0;
    let currentBreakDuration = 0;
    
    if (activeShift) {
      currentStatus = activeShift.shiftStatus;
      
      // Calculate current shift duration
      if (activeShift.startTime) {
        const shiftStartTime = new Date(activeShift.startTime);
        const lastBreakEndTime = activeShift.breaks.length > 0 && 
                               activeShift.breaks[activeShift.breaks.length - 1].endTime ? 
                               new Date(activeShift.breaks[activeShift.breaks.length - 1].endTime) : null;
        
        // If on break, calculate work time up to break start
        if (currentStatus === 'break' && activeShift.breaks.length > 0) {
          const currentBreak = activeShift.breaks[activeShift.breaks.length - 1];
          const breakStartTime = new Date(currentBreak.startTime);
          
          currentShiftDuration = Math.floor((breakStartTime - shiftStartTime) / 60000);
          
          // Calculate current break duration
          currentBreakDuration = Math.floor((now - breakStartTime) / 60000);
        } else {
          // If working, calculate from start time or last break end
          const startPoint = lastBreakEndTime || shiftStartTime;
          currentShiftDuration = Math.floor((now - startPoint) / 60000);
        }
      }
    }
    
    // Get recent notifications
    const recentNotifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get unread notification count
    const unreadNotifications = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });
    
    // Get upcoming shifts (if schedule feature is implemented)
    const upcomingShifts = []; // Placeholder for scheduled shifts
    
    // Combine all dashboard data
    const dashboardData = {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        position: user.position,
        profilePicture: user.profilePicture
      },
      currentShift: activeShift ? {
        id: activeShift._id,
        status: currentStatus,
        startTime: activeShift.startTime,
        currentDuration: currentShiftDuration,
        currentBreakDuration,
        location: activeShift.startLocation
      } : null,
      todayStats: {
        completedShifts: todayShifts.length,
        totalWorkHours: ((todayWorkMinutes + (currentStatus === 'active' ? currentShiftDuration : 0)) / 60).toFixed(2),
        totalBreakHours: ((todayBreakMinutes + (currentStatus === 'break' ? currentBreakDuration : 0)) / 60).toFixed(2)
      },
      notifications: {
        recent: recentNotifications,
        unreadCount: unreadNotifications
      },
      upcomingShifts
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard data error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Upload profile avatar
 * @route POST /api/users/profile/avatar
 * @access Private
 */
exports.uploadAvatar = async (req, res) => {
  try {
    // In a real implementation, you would handle file upload here
    // This is a simplified version that assumes the image is sent as base64
    const { avatar } = req.body;
    
    if (!avatar) {
      return res.status(400).json({ msg: 'No avatar provided' });
    }
    
    // Update user with new avatar
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { profilePicture: avatar } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json({
      msg: 'Avatar uploaded successfully',
      profilePicture: user.profilePicture
    });
  } catch (error) {
    console.error('Upload avatar error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Delete profile avatar
 * @route DELETE /api/users/profile/avatar
 * @access Private
 */
exports.deleteAvatar = async (req, res) => {
  try {
    // Update user to remove avatar
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { profilePicture: null } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json({ msg: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Delete avatar error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get user settings
 * @route GET /api/users/settings
 * @access Private
 */
exports.getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings notifications preferences');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Use default settings if not set
    const settings = user.settings || {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      locationTracking: {
        allowBackgroundTracking: false,
        accuracy: 'high'
      }
    };
    
    res.json(settings);
  } catch (error) {
    console.error('Get user settings error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Update user settings
 * @route PUT /api/users/settings
 * @access Private
 */
exports.updateUserSettings = async (req, res) => {
  try {
    const { theme, language, notifications, locationTracking } = req.body;
    
    // Build settings object
    const settingsUpdate = {};
    if (theme) settingsUpdate.theme = theme;
    if (language) settingsUpdate.language = language;
    if (notifications) settingsUpdate.notifications = notifications;
    if (locationTracking) settingsUpdate.locationTracking = locationTracking;
    
    // Update user settings
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { settings: settingsUpdate } },
      { new: true }
    ).select('settings');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json({
      msg: 'Settings updated successfully',
      settings: user.settings
    });
  } catch (error) {
    console.error('Update user settings error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};