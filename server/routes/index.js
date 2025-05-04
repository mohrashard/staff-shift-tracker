const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const shiftRoutes = require('./shiftRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');

/**
 * Main router configuration to handle all API routes
 * Each route module is mounted at its respective base path
 */

// Authentication routes - login, register, token management
router.use('/auth', authRoutes);

// Shift management routes - start/end shifts, breaks, statistics
router.use('/shifts', shiftRoutes);

// User profile and settings routes
router.use('/users', userRoutes);

// Admin-only routes for user management and reports
router.use('/admin', adminRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.status(200).json({
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      shifts: '/api/shifts/*',
      users: '/api/users/*',
      admin: '/api/admin/*'
    },
    documentation: 'For detailed documentation, please refer to the Postman collection or API docs'
  });
});

module.exports = router;