/**
 * Admin role verification middleware
 * Checks if authenticated user has admin role
 * Must be used after auth middleware since it depends on req.user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const admin = (req, res, next) => {
    try {
      // Check if user exists in request (auth middleware should have set this)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required before checking admin privileges.'
        });
      }
  
      // Check if user has admin role
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
  
      // If user is admin, proceed to next middleware
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Admin authorization failed.',
        error: error.message
      });
    }
  };
  
  module.exports = admin;