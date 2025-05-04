const { ValidationError } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Global error handling middleware
 * Catches all errors thrown in the application and formats responses
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} - JSON response with error details
 */
const errorHandler = (err, req, res, next) => {
  // Console log for server debugging
  console.error(`Error: ${err.message}`);
  console.error(err.stack);

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';
  let errors = [];
  let errorType = 'server_error';

  // Handle specific error types
  if (err instanceof mongoose.Error.ValidationError) {
    // Mongoose validation errors
    statusCode = 400;
    message = 'Validation Error';
    errorType = 'validation_error';
    
    // Format mongoose validation errors
    Object.keys(err.errors).forEach(key => {
      errors.push({
        field: key,
        message: err.errors[key].message
      });
    });
  } else if (err instanceof mongoose.Error.CastError) {
    // Mongoose cast errors (e.g., invalid ObjectId)
    statusCode = 400;
    message = 'Invalid ID format';
    errorType = 'invalid_id';
    errors.push({
      field: err.path,
      message: 'Invalid format'
    });
  } else if (err.name === 'MongoServerError' && err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    message = 'Duplicate value error';
    errorType = 'duplicate_value';
    
    // Extract the duplicate field from the error message
    const field = Object.keys(err.keyValue)[0];
    errors.push({
      field,
      message: `The ${field} already exists.`
    });
  } else if (Array.isArray(err)) {
    // Handle express-validator validation errors array
    statusCode = 400;
    message = 'Validation Error';
    errorType = 'validation_error';
    errors = err.map(error => ({
      field: error.param,
      message: error.msg
    }));
  } else if (err.type === 'entity.parse.failed') {
    // JSON parse error
    statusCode = 400;
    message = 'Invalid JSON in request body';
    errorType = 'invalid_json';
  }

  // Respond with error details
  res.status(statusCode).json({
    success: false,
    message,
    errorType,
    errors: errors.length > 0 ? errors : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;