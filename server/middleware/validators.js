const { body, param, query, validationResult } = require('express-validator');

/**
 * Validates request and returns errors if any
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validation rules for user signup
 */
exports.validateSignup = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
  body('department').optional().trim().notEmpty().withMessage('Department cannot be empty'),
  body('position').optional().trim().notEmpty().withMessage('Position cannot be empty'),
  body('phoneNumber').optional()
    .matches(/^\+?[0-9]{10,15}$/).withMessage('Please provide a valid phone number'),
  validate
];

/**
 * Validation rules for user login
 */
exports.validateLogin = [
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  validate
];

/**
 * Validation rules for user profile update
 */
exports.validateUserUpdate = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('department').optional().trim().notEmpty().withMessage('Department cannot be empty'),
  body('position').optional().trim().notEmpty().withMessage('Position cannot be empty'),
  body('phoneNumber').optional()
    .matches(/^\+?[0-9]{10,15}$/).withMessage('Please provide a valid phone number'),
  validate
];

/**
 * Validation rules for password update
 */
exports.validatePasswordUpdate = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
  validate
];

/**
 * Validation rules for location data
 */
exports.validateLocation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('accuracy').optional()
    .isFloat({ min: 0 }).withMessage('Accuracy must be a positive number'),
  validate
];

/**
 * Validation rules for shift ID parameter
 */
exports.validateShiftId = [
  param('id').isMongoId().withMessage('Invalid shift ID format'),
  validate
];

/**
 * Validation rules for pagination
 */
exports.validatePagination = [
  query('page').optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validate
];

/**
 * Validation rules for date range
 */
exports.validateDateRange = [
  query('startDate').optional()
    .isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional()
    .isISO8601().withMessage('End date must be a valid date'),
  validate
];

/**
 * Validation rules for admin user updates
 */
exports.validateAdminUserUpdate = [
  ...exports.validateUserUpdate,
  body('isAdmin').optional().isBoolean().withMessage('isAdmin must be a boolean'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  validate
];

/**
 * Validation rules for notification creation
 */
exports.validateNotification = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('users').optional().isArray().withMessage('Users must be an array'),
  body('users.*').optional().isMongoId().withMessage('User IDs must be valid'),
  body('departments').optional().isArray().withMessage('Departments must be an array'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  validate
];