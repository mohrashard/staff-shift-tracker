const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['shift_completed', 'break_exceeded', 'shift_reminder', 'admin_message'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Automatically creates createdAt and updatedAt fields
});

// Static method to create a shift completion notification
NotificationSchema.statics.createShiftCompleteNotification = async function(userId, shiftData) {
  const message = `You have completed your shift with a total of ${shiftData.totalWorkDuration.toFixed(2)} 
                  minutes worked and ${shiftData.totalBreakDuration.toFixed(2)} minutes on breaks.`;
  
  return this.create({
    userId,
    type: 'shift_completed',
    message
  });
};

// Static method to create a break exceeded notification
NotificationSchema.statics.createBreakExceededNotification = async function(userId, breakType, duration) {
  const message = `Your ${breakType} break has exceeded the recommended duration by ${duration} minutes.`;
  
  return this.create({
    userId,
    type: 'break_exceeded',
    message
  });
};

// Static method to get unread notifications for a user
NotificationSchema.statics.getUnreadByUser = function(userId) {
  return this.find({ userId, isRead: false }).sort({ createdAt: -1 });
};

// Method to mark as read
NotificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

module.exports = mongoose.model('Notification', NotificationSchema);