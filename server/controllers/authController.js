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

    // Generate JWT token
    const token = generateToken(user);

    // Return user data and token
    res.json({
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
 * @route POST /api/auth/verify
 * @access Public
 */
exports.verifyToken = (req, res) => {
  try {
    const token = req.header('x-auth-token');
    
    if (!token) {
      return res.status(401).json({ valid: false });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false });
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