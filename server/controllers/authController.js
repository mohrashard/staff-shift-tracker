const User = require('../models/user');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

/**
 * Generate JWT token for user
 * @param {Object} user - User document
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Generate refresh token for user
 * @param {Object} user - User document
 * @returns {String} Refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
exports.register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      employeeId, 
      firstName, 
      lastName, 
      email, 
      password, 
      department, 
      position 
    } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists with this email' });
    }

    // Check if employee ID is unique
    user = await User.findOne({ employeeId });
    if (user) {
      return res.status(400).json({ msg: 'Employee ID already exists' });
    }

    // Create new user
    user = new User({
      employeeId,
      firstName,
      lastName,
      email,
      password,
      department,
      position
    });

    // Save user to database
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    // Return user data and token
    res.status(201).json({
      token,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
exports.login = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ msg: 'Account is deactivated. Please contact admin.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Generate JWT tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Return user data and tokens
    res.json({
      token,
      refreshToken,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get current user data
 * @route GET /api/auth/me
 * @access Private
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Verify JWT token
 * @route GET /api/auth/verify
 * @access Public
 */
exports.verifyToken = (req, res) => {
  try {
    // Auth middleware already verified the token, so we just return success
    res.json({ valid: true, user: req.user });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
};

/**
 * Logout user (invalidate token)
 * @route POST /api/auth/logout
 * @access Private
 */
exports.logout = async (req, res) => {
  try {
    // In a stateless JWT setup, client-side should delete the token
    // Here we could implement a token blacklist if needed
    
    res.json({ msg: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Refresh JWT token
 * @route POST /api/auth/refresh-token
 * @access Public (with refresh token)
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ msg: 'No refresh token provided' });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken, 
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET
    );
    
    // Get user from database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Generate new access token
    const newToken = generateToken(user);
    
    res.json({ token: newToken });
  } catch (error) {
    console.error('Refresh token error:', error.message);
    res.status(401).json({ msg: 'Invalid or expired refresh token' });
  }
};

/**
 * Change password
 * @route PUT /api/auth/password
 * @access Private
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ msg: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Request password reset (sends email with reset token)
 * @route POST /api/auth/forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Generate reset token (would typically send via email)
    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // In a real app, you would send an email with the reset link
    // For this example, we'll just return the token
    
    res.json({ 
      msg: 'Password reset instructions sent to your email',
      // In production, don't return this token in the response
      // This is just for demonstration
      resetToken
    });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Reset password using token
 * @route POST /api/auth/reset-password/:token
 * @access Public
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found or token expired' });
    }
    
    // Update password
    user.password = password;
    await user.save();
    
    res.json({ msg: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Invalid or expired token' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
};