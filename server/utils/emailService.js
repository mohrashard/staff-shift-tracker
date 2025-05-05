const nodemailer = require('nodemailer');
const { formatDuration, toDecimalHours } = require('./timeUtils');

/**
 * Configure email transporter
 * For development, use a testing service like Ethereal or Mailtrap
 * For production, use a real SMTP service
 */
const createTransporter = () => {
  // For production
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  
  // For development (using Ethereal - a fake SMTP service)
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.DEV_EMAIL_USER || 'ethereal_user',
      pass: process.env.DEV_EMAIL_PASS || 'ethereal_pass'
    }
  });
};

/**
 * Generate email for shift completion
 * @param {Object} user - User object
 * @param {Object} shift - Completed shift object
 * @returns {Object} Email options object
 */
const generateShiftCompletionEmail = (user, shift) => {
  const startTime = new Date(shift.startTime);
  const endTime = new Date(shift.endTime);
  
  // Calculate total shift duration
  const totalDuration = endTime.getTime() - startTime.getTime();
  const formattedDuration = formatDuration(totalDuration);
  
  // Calculate break time
  const breakDuration = shift.breaks.reduce((total, breakItem) => {
    if (breakItem.startTime && breakItem.endTime) {
      const breakStart = new Date(breakItem.startTime);
      const breakEnd = new Date(breakItem.endTime);
      return total + (breakEnd.getTime() - breakStart.getTime());
    }
    return total;
  }, 0);
  
  const formattedBreakDuration = formatDuration(breakDuration);
  
  // Calculate working time (total - breaks)
  const workingDuration = totalDuration - breakDuration;
  const formattedWorkingDuration = formatDuration(workingDuration);
  const decimalHours = toDecimalHours(workingDuration);
  
  // Format start and end times
  const formatTimeOptions = { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };
  
  const formattedStartTime = startTime.toLocaleString('en-US', formatTimeOptions);
  const formattedEndTime = endTime.toLocaleString('en-US', formatTimeOptions);
  
  return {
    from: `"${process.env.APP_NAME || 'Shift Tracker'}" <${process.env.EMAIL_FROM || 'noreply@shifttracker.com'}>`,
    to: user.email,
    subject: `Shift Completed - ${formattedStartTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333;">Shift Summary for ${user.firstName} ${user.lastName}</h2>
        
        <p>Hello ${user.firstName},</p>
        
        <p>Your shift has been successfully recorded. Here's a summary:</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Start:</strong> ${formattedStartTime}</p>
          <p><strong>End:</strong> ${formattedEndTime}</p>
          <p><strong>Total Duration:</strong> ${formattedDuration.formatted}</p>
          <p><strong>Break Duration:</strong> ${formattedBreakDuration.formatted}</p>
          <p><strong>Working Time:</strong> ${formattedWorkingDuration.formatted} (${decimalHours} hours)</p>
        </div>
        
        <h3>Location Details</h3>
        <p><strong>Start Location:</strong> ${shift.startLocation.address || 'Not available'}</p>
        <p><strong>End Location:</strong> ${shift.endLocation.address || 'Not available'}</p>
        
        <p style="margin-top: 20px;">If you have any questions or notice any discrepancies, please contact your supervisor.</p>
        
        <p style="color: #666; font-size: 0.8em; margin-top: 30px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
      Shift Summary for ${user.firstName} ${user.lastName}
      
      Hello ${user.firstName},
      
      Your shift has been successfully recorded. Here's a summary:
      
      Start: ${formattedStartTime}
      End: ${formattedEndTime}
      Total Duration: ${formattedDuration.formatted}
      Break Duration: ${formattedBreakDuration.formatted}
      Working Time: ${formattedWorkingDuration.formatted} (${decimalHours} hours)
      
      Location Details:
      Start Location: ${shift.startLocation.address || 'Not available'}
      End Location: ${shift.endLocation.address || 'Not available'}
      
      If you have any questions or notice any discrepancies, please contact your supervisor.
      
      This is an automated message. Please do not reply to this email.
    `
  };
};

/**
 * Send shift completion email
 * @param {Object} user - User object
 * @param {Object} shift - Completed shift object
 * @returns {Promise} Email sending result
 */
const sendShiftCompletionEmail = async (user, shift) => {
  try {
    const transporter = createTransporter();
    const mailOptions = generateShiftCompletionEmail(user, shift);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Shift completion email sent:', info.messageId);
    
    // For development, log preview URL from Ethereal
    if (process.env.NODE_ENV !== 'production' && info.messageId) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending shift completion email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification email to supervisors for irregular activity
 * @param {Object} user - User whose shift has irregularities
 * @param {Object} shift - Shift object with irregularities
 * @param {String} irregularityType - Type of irregularity
 * @param {String} details - Additional details about the irregularity
 * @returns {Promise} Email sending result
 */
const sendIrregularityAlert = async (user, shift, irregularityType, details) => {
  try {
    const transporter = createTransporter();
    
    // Get supervisor emails from environment variable (comma-separated)
    const supervisorEmails = process.env.SUPERVISOR_EMAILS ? 
      process.env.SUPERVISOR_EMAILS.split(',').map(email => email.trim()) : 
      [];
    
    if (supervisorEmails.length === 0) {
      return { success: false, error: 'No supervisor emails configured' };
    }
    
    const startTime = new Date(shift.startTime);
    const formattedStartTime = startTime.toLocaleString('en-US', {
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Shift Tracker'}" <${process.env.EMAIL_FROM || 'alerts@shifttracker.com'}>`,
      to: supervisorEmails.join(', '),
      subject: `ALERT: ${irregularityType} - ${user.firstName} ${user.lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ff4d4d; border-radius: 5px;">
          <h2 style="color: #ff4d4d;">Shift Irregularity Alert</h2>
          
          <p><strong>Employee:</strong> ${user.firstName} ${user.lastName} (ID: ${user._id})</p>
          <p><strong>Shift Date:</strong> ${formattedStartTime}</p>
          <p><strong>Issue Type:</strong> ${irregularityType}</p>
          
          <div style="background-color: #fff0f0; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Details:</strong></p>
            <p>${details}</p>
          </div>
          
          <p>Please investigate this issue at your earliest convenience.</p>
          
          <p style="margin-top: 20px;">
            <a href="${process.env.ADMIN_DASHBOARD_URL || '#'}" style="background-color: #0066cc; color: white; padding: 10px 15px; text-decoration: none; border-radius: 3px;">
              View in Dashboard
            </a>
          </p>
        </div>
      `,
      text: `
        Shift Irregularity Alert
        
        Employee: ${user.firstName} ${user.lastName} (ID: ${user._id})
        Shift Date: ${formattedStartTime}
        Issue Type: ${irregularityType}
        
        Details:
        ${details}
        
        Please investigate this issue at your earliest convenience.
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Irregularity alert email sent:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending irregularity alert email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendShiftCompletionEmail,
  sendIrregularityAlert
};