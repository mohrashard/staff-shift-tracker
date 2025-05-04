const mongoose = require('mongoose');

// Location schema (reused in multiple places)
const LocationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  address: {
    type: String,
    default: ''
  }
}, { _id: false });

// Timestamp with location schema (reused in multiple places)
const TimestampLocationSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true
  },
  location: {
    type: LocationSchema,
    required: true
  }
}, { _id: false });

// Break schema
const BreakSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['lunch', 'short'],
    required: true
  },
  startTime: {
    type: TimestampLocationSchema,
    required: true
  },
  endTime: {
    type: TimestampLocationSchema,
    default: null
  },
  duration: {
    type: Number,
    default: 0 // in minutes
  }
}, { _id: true });

// Main shift schema
const ShiftSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  shiftStatus: {
    type: String,
    enum: ['active', 'break', 'completed'],
    default: 'active'
  },
  startTime: {
    type: TimestampLocationSchema,
    required: true
  },
  breaks: [BreakSchema],
  endTime: {
    type: TimestampLocationSchema,
    default: null
  },
  totalWorkDuration: {
    type: Number,
    default: 0 // in minutes
  },
  totalBreakDuration: {
    type: Number,
    default: 0 // in minutes
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true // Automatically creates createdAt and updatedAt fields
});

// Method to calculate total work duration
ShiftSchema.methods.calculateWorkDuration = function() {
  if (!this.endTime) return 0;
  
  // Calculate raw duration in milliseconds
  const rawDurationMs = this.endTime.timestamp - this.startTime.timestamp;
  // Convert to minutes
  const rawDurationMinutes = rawDurationMs / (1000 * 60);
  // Subtract break time
  return rawDurationMinutes - this.totalBreakDuration;
};

// Method to add a new break
ShiftSchema.methods.startBreak = function(breakType, location) {
  const newBreak = {
    type: breakType,
    startTime: {
      timestamp: new Date(),
      location: location
    }
  };
  
  this.breaks.push(newBreak);
  this.shiftStatus = 'break';
  return newBreak;
};

// Method to end the current break
ShiftSchema.methods.endBreak = function(location) {
  if (this.breaks.length === 0) return null;
  
  const currentBreak = this.breaks[this.breaks.length - 1];
  if (currentBreak.endTime) return null; // Break already ended
  
  const endTime = new Date();
  currentBreak.endTime = {
    timestamp: endTime,
    location: location
  };
  
  // Calculate break duration in minutes
  const breakDurationMs = endTime - currentBreak.startTime.timestamp;
  currentBreak.duration = breakDurationMs / (1000 * 60);
  
  // Update total break duration
  this.totalBreakDuration += currentBreak.duration;
  this.shiftStatus = 'active';
  
  return currentBreak;
};

// Method to end the shift
ShiftSchema.methods.endShift = function(location) {
  if (this.shiftStatus === 'break') {
    // End any ongoing break first
    this.endBreak(location);
  }
  
  this.endTime = {
    timestamp: new Date(),
    location: location
  };
  
  this.totalWorkDuration = this.calculateWorkDuration();
  this.shiftStatus = 'completed';
  
  return this;
};

module.exports = mongoose.model('Shift', ShiftSchema);