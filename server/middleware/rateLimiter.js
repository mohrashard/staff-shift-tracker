const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');

/**
 * Configure rate limiters for different API endpoints
 * Uses MongoDB to store rate limit data for persistence across server restarts
 */

// MongoDB store configuration for rate limiter
const mongoStoreConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_shift_tracker',
  collectionName: 'rate_limits',
  expireTimeMs: 60 * 60 * 1000, // 1 hour in milliseconds
  errorHandler: console.error.bind(null, 'rate-limit-mongo')
};

// General API rate limiter
exports.apiLimiter = rateLimit({
  store: new MongoStore(mongoStoreConfig),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Authentication endpoints rate limiter (more strict)
exports.authLimiter = rateLimit({
  store: new MongoStore({
    ...mongoStoreConfig,
    collectionName: 'auth_rate_limits'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 failed authentication attempts per hour
  skipSuccessfulRequests: true, // Don't count successful logins against the limit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed login attempts, please try again after an hour.'
  }
});

// Registration endpoints rate limiter
exports.registerLimiter = rateLimit({
  store: new MongoStore({
    ...mongoStoreConfig,
    collectionName: 'register_rate_limits'
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // Limit each IP to 3 registration attempts per day
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts, please try again tomorrow.'
  }
});

// Password reset rate limiter
exports.passwordResetLimiter = rateLimit({
  store: new MongoStore({
    ...mongoStoreConfig,
    collectionName: 'password_reset_rate_limits'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again after an hour.'
  }
});

// Shift action rate limiter
exports.shiftActionLimiter = rateLimit({
  store: new MongoStore({
    ...mongoStoreConfig,
    collectionName: 'shift_action_rate_limits'
  }),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 shift actions per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many shift actions, please try again later.'
  }
});