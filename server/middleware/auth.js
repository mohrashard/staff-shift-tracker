const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { TokenExpiredError } = jwt;

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by id and check if token is still valid
    // (in case user logged out from all devices or token was invalidated)
    const user = await User.findOne({ 
      _id: decoded.user.id,
      'tokens.token': token 
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token is invalid or has been revoked.' 
      });
    }

    // Add user and token to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token has expired. Please login again.',
        expired: true
      });
    }
    
    res.status(401).json({ 
      success: false, 
      message: 'Invalid authentication token.',
      error: error.message
    });
  }
};

module.exports = auth;