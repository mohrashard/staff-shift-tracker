const User = require('../models/user');
const Shift = require('../models/shift');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

/**
 * Get all employees for admin dashboard
 * @route GET /api/admin/employees
 * @access Private/Admin
 */
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: { $ne: 'admin' } })
      .select('-password -refreshToken')
      .sort({ lastName: 1, firstName: 1 });
    
    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees
    });
  } catch (error) {
    console.error('Error in getAllEmployees:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Get all shifts for admin dashboard with filtering options
 * @route GET /api/admin/shifts
 * @access Private/Admin
 */
exports.getAllShifts = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      employeeId, 
      department,
      status,
      sortBy = 'startTime',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (startDate && endDate) {
      filter.startTime = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    } else if (startDate) {
      filter.startTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.startTime = { $lte: new Date(endDate) };
    }
    
    if (employeeId) {
      filter.employee = mongoose.Types.ObjectId(employeeId);
    }
    
    if (status) {
      filter.status = status;
    }

    // For department filtering, we need to join with User collection
    let employeeIds = [];
    if (department) {
      const departmentEmployees = await User.find({ department }).select('_id');
      employeeIds = departmentEmployees.map(emp => emp._id);
      filter.employee = { $in: employeeIds };
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Define sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const shifts = await Shift.find(filter)
      .populate('employee', 'firstName lastName email department')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Shift.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: shifts.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: shifts
    });
  } catch (error) {
    console.error('Error in getAllShifts:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Get shift details by ID for admin
 * @route GET /api/admin/shifts/:id
 * @access Private/Admin
 */
exports.getShiftById = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate('employee', 'firstName lastName email department');
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: shift
    });
  } catch (error) {
    console.error('Error in getShiftById:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Update shift details (admin override)
 * @route PUT /api/admin/shifts/:id
 * @access Private/Admin
 */
exports.updateShift = async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      breaks,
      status,
      notes
    } = req.body;
    
    // Find shift first to check if it exists
    const shift = await Shift.findById(req.params.id);
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }
    
    // Calculate total duration and break duration if both start and end times exist
    let totalDuration = shift.totalDuration;
    let breakDuration = shift.breakDuration || 0;
    
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      totalDuration = (end - start) / (1000 * 60 * 60); // in hours
    }
    
    // Calculate break duration if breaks are provided
    if (breaks && breaks.length > 0) {
      breakDuration = breaks.reduce((total, breakItem) => {
        if (breakItem.startTime && breakItem.endTime) {
          const breakStart = new Date(breakItem.startTime);
          const breakEnd = new Date(breakItem.endTime);
          return total + ((breakEnd - breakStart) / (1000 * 60 * 60)); // in hours
        }
        return total;
      }, 0);
    }
    
    // Calculate worked hours (total duration minus break duration)
    const workedHours = totalDuration - breakDuration;
    
    // Update the shift
    const updatedShift = await Shift.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...req.body,
          totalDuration,
          breakDuration,
          workedHours,
          updatedAt: Date.now(),
          lastModifiedBy: req.user._id,
          adminEdited: true
        }
      },
      { new: true, runValidators: true }
    ).populate('employee', 'firstName lastName email');
    
    res.status(200).json({
      success: true,
      data: updatedShift,
      message: 'Shift updated successfully'
    });
  } catch (error) {
    console.error('Error in updateShift:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Delete a shift
 * @route DELETE /api/admin/shifts/:id
 * @access Private/Admin
 */
exports.deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }
    
    await shift.remove();
    
    res.status(200).json({
      success: true,
      message: 'Shift deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteShift:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Get analytics data for admin dashboard
 * @route GET /api/admin/analytics
 * @access Private/Admin
 */
exports.getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Default to current month if no dates provided
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1)); // First day of current month
    const end = endDate ? new Date(endDate) : new Date(new Date().setMonth(new Date().getMonth() + 1, 0)); // Last day of current month
    
    // Build filter for shifts
    const shiftFilter = {
      startTime: { $gte: start, $lte: end },
      status: 'completed'
    };
    
    // For department filtering
    if (department) {
      const departmentEmployees = await User.find({ department }).select('_id');
      const employeeIds = departmentEmployees.map(emp => emp._id);
      shiftFilter.employee = { $in: employeeIds };
    }
    
    // Get total employees
    const totalEmployees = await User.countDocuments({ role: { $ne: 'admin' } });
    
    // Get active employees (those with at least one shift in the period)
    const activeEmployeesResult = await Shift.aggregate([
      { $match: shiftFilter },
      { $group: { _id: '$employee' } },
      { $count: 'activeCount' }
    ]);
    const activeEmployees = activeEmployeesResult.length > 0 ? activeEmployeesResult[0].activeCount : 0;
    
    // Get total shifts
    const totalShifts = await Shift.countDocuments(shiftFilter);
    
    // Get total hours worked
    const hoursResult = await Shift.aggregate([
      { $match: shiftFilter },
      { $group: { 
        _id: null,
        totalHours: { $sum: '$workedHours' },
        totalBreakHours: { $sum: '$breakDuration' }
      }}
    ]);
    
    const totalWorkedHours = hoursResult.length > 0 ? hoursResult[0].totalHours : 0;
    const totalBreakHours = hoursResult.length > 0 ? hoursResult[0].totalBreakHours : 0;
    
    // Get average hours per employee
    const avgHoursPerEmployee = totalEmployees > 0 ? totalWorkedHours / totalEmployees : 0;
    
    // Get average shifts per employee
    const avgShiftsPerEmployee = totalEmployees > 0 ? totalShifts / totalEmployees : 0;
    
    // Get department breakdown
    const departmentBreakdown = await User.aggregate([
      { $match: { role: { $ne: 'admin' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get hourly data for charts (last 7 days by default)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const hourlyData = await Shift.aggregate([
      { 
        $match: { 
          startTime: { $gte: last7Days },
          status: 'completed'
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$startTime' },
            month: { $month: '$startTime' },
            day: { $dayOfMonth: '$startTime' }
          },
          totalHours: { $sum: '$workedHours' },
          shiftsCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Format hourly data for charts
    const formattedHourlyData = hourlyData.map(day => {
      const date = new Date(day._id.year, day._id.month - 1, day._id.day);
      return {
        date: date.toISOString().split('T')[0],
        totalHours: Math.round(day.totalHours * 100) / 100, // Round to 2 decimal places
        shiftsCount: day.shiftsCount
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalEmployees,
          activeEmployees,
          totalShifts,
          totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
          totalBreakHours: Math.round(totalBreakHours * 100) / 100,
          avgHoursPerEmployee: Math.round(avgHoursPerEmployee * 100) / 100,
          avgShiftsPerEmployee: Math.round(avgShiftsPerEmployee * 100) / 100
        },
        departmentBreakdown,
        hourlyData: formattedHourlyData
      }
    });
  } catch (error) {
    console.error('Error in getAnalytics:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Export shifts data as CSV
 * @route GET /api/admin/export/csv
 * @access Private/Admin
 */
exports.exportToCSV = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (startDate && endDate) {
      filter.startTime = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    
    if (employeeId) {
      filter.employee = mongoose.Types.ObjectId(employeeId);
    }
    
    // For department filtering
    if (department) {
      const departmentEmployees = await User.find({ department }).select('_id');
      const employeeIds = departmentEmployees.map(emp => emp._id);
      filter.employee = { $in: employeeIds };
    }
    
    // Get shifts data
    const shifts = await Shift.find(filter)
      .populate('employee', 'firstName lastName email department employeeId')
      .sort({ startTime: -1 });
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No shifts found with the specified criteria'
      });
    }
    
    // Prepare data for CSV
    const shiftsData = shifts.map(shift => {
      return {
        'Employee ID': shift.employee.employeeId || 'N/A',
        'Employee Name': `${shift.employee.firstName} ${shift.employee.lastName}`,
        'Department': shift.employee.department,
        'Email': shift.employee.email,
        'Shift Date': moment(shift.startTime).format('YYYY-MM-DD'),
        'Start Time': moment(shift.startTime).format('HH:mm:ss'),
        'End Time': shift.endTime ? moment(shift.endTime).format('HH:mm:ss') : 'Not Ended',
        'Start Location': shift.startLocation ? shift.startLocation.address : 'N/A',
        'End Location': shift.endLocation ? shift.endLocation.address : 'N/A',
        'Status': shift.status,
        'Total Hours': shift.totalDuration ? shift.totalDuration.toFixed(2) : 'N/A',
        'Break Hours': shift.breakDuration ? shift.breakDuration.toFixed(2) : '0.00',
        'Work Hours': shift.workedHours ? shift.workedHours.toFixed(2) : 'N/A',
        'Number of Breaks': shift.breaks ? shift.breaks.length : 0,
        'Notes': shift.notes || ''
      };
    });
    
    // Convert to CSV
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(shiftsData);
    
    // Set filename
    const fileName = `shifts_export_${moment().format('YYYY-MM-DD_HH-mm-ss')}.csv`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    
    // Send the CSV data
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error in exportToCSV:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Export shifts data as Excel
 * @route GET /api/admin/export/excel
 * @access Private/Admin
 */
exports.exportToExcel = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (startDate && endDate) {
      filter.startTime = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    
    if (employeeId) {
      filter.employee = mongoose.Types.ObjectId(employeeId);
    }
    
    // For department filtering
    if (department) {
      const departmentEmployees = await User.find({ department }).select('_id');
      const employeeIds = departmentEmployees.map(emp => emp._id);
      filter.employee = { $in: employeeIds };
    }
    
    // Get shifts data
    const shifts = await Shift.find(filter)
      .populate('employee', 'firstName lastName email department employeeId')
      .sort({ startTime: -1 });
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No shifts found with the specified criteria'
      });
    }
    
    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Shifts');
    
    // Define columns
    worksheet.columns = [
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Shift Date', key: 'shiftDate', width: 15 },
      { header: 'Start Time', key: 'startTime', width: 15 },
      { header: 'End Time', key: 'endTime', width: 15 },
      { header: 'Start Location', key: 'startLocation', width: 30 },
      { header: 'End Location', key: 'endLocation', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Total Hours', key: 'totalHours', width: 15 },
      { header: 'Break Hours', key: 'breakHours', width: 15 },
      { header: 'Work Hours', key: 'workHours', width: 15 },
      { header: 'Number of Breaks', key: 'breakCount', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];
    
    // Add style to header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add data rows
    shifts.forEach(shift => {
      worksheet.addRow({
        employeeId: shift.employee.employeeId || 'N/A',
        employeeName: `${shift.employee.firstName} ${shift.employee.lastName}`,
        department: shift.employee.department,
        email: shift.employee.email,
        shiftDate: moment(shift.startTime).format('YYYY-MM-DD'),
        startTime: moment(shift.startTime).format('HH:mm:ss'),
        endTime: shift.endTime ? moment(shift.endTime).format('HH:mm:ss') : 'Not Ended',
        startLocation: shift.startLocation ? shift.startLocation.address : 'N/A',
        endLocation: shift.endLocation ? shift.endLocation.address : 'N/A',
        status: shift.status,
        totalHours: shift.totalDuration ? shift.totalDuration.toFixed(2) : 'N/A',
        breakHours: shift.breakDuration ? shift.breakDuration.toFixed(2) : '0.00',
        workHours: shift.workedHours ? shift.workedHours.toFixed(2) : 'N/A',
        breakCount: shift.breaks ? shift.breaks.length : 0,
        notes: shift.notes || ''
      });
    });
    
    // Add a summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    
    // Calculate summary data
    const totalShifts = shifts.length;
    const completedShifts = shifts.filter(s => s.status === 'completed').length;
    const inProgressShifts = shifts.filter(s => s.status === 'in-progress').length;
    
    // Total hours calculation
    const totalHours = shifts.reduce((total, shift) => {
      return total + (shift.workedHours || 0);
    }, 0);
    
    // Break hours calculation
    const totalBreakHours = shifts.reduce((total, shift) => {
      return total + (shift.breakDuration || 0);
    }, 0);
    
    // Total employees
    const uniqueEmployees = new Set(shifts.map(s => s.employee._id.toString())).size;
    
    // Add summary data
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add summary rows
    summarySheet.addRow({ metric: 'Report Generated', value: moment().format('YYYY-MM-DD HH:mm:ss') });
    summarySheet.addRow({ metric: 'Date Range', value: `${startDate || 'All'} to ${endDate || 'All'}` });
    summarySheet.addRow({ metric: 'Total Shifts', value: totalShifts });
    summarySheet.addRow({ metric: 'Completed Shifts', value: completedShifts });
    summarySheet.addRow({ metric: 'In-Progress Shifts', value: inProgressShifts });
    summarySheet.addRow({ metric: 'Total Employees', value: uniqueEmployees });
    summarySheet.addRow({ metric: 'Total Work Hours', value: totalHours.toFixed(2) });
    summarySheet.addRow({ metric: 'Total Break Hours', value: totalBreakHours.toFixed(2) });
    summarySheet.addRow({ metric: 'Average Hours Per Shift', value: (totalHours / totalShifts).toFixed(2) });
    
    // Set filename
    const fileName = `shifts_export_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    const filePath = path.join(__dirname, '..', 'temp', fileName);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write to file
    await workbook.xlsx.writeFile(filePath);
    
    // Send file for download
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        return res.status(500).json({
          success: false,
          error: 'Error downloading file',
          message: err.message
        });
      }
      
      // Delete the file after download
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('Error in exportToExcel:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Export shifts data as PDF
 * @route GET /api/admin/export/pdf
 * @access Private/Admin
 */
exports.exportToPDF = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (startDate && endDate) {
      filter.startTime = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    
    if (employeeId) {
      filter.employee = mongoose.Types.ObjectId(employeeId);
    }
    
    // For department filtering
    if (department) {
      const departmentEmployees = await User.find({ department }).select('_id');
      const employeeIds = departmentEmployees.map(emp => emp._id);
      filter.employee = { $in: employeeIds };
    }
    
    // Get shifts data
    const shifts = await Shift.find(filter)
      .populate('employee', 'firstName lastName email department employeeId')
      .sort({ startTime: -1 })
      .limit(100); // Limit to prevent huge PDFs
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No shifts found with the specified criteria'
      });
    }
    
    // Calculate summary data
    const totalShifts = shifts.length;
    const completedShifts = shifts.filter(s => s.status === 'completed').length;
    const inProgressShifts = shifts.filter(s => s.status === 'in-progress').length;
    
    // Total hours calculation
    const totalHours = shifts.reduce((total, shift) => {
      return total + (shift.workedHours || 0);
    }, 0);
    
    // Set filename
    const fileName = `shifts_export_${moment().format('YYYY-MM-DD_HH-mm-ss')}.pdf`;
    const filePath = path.join(__dirname, '..', 'temp', fileName);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a PDF document
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      info: {
        Title: 'Employee Shifts Report',
        Author: 'Shift Tracker Application'
      }
    });
    
    // Pipe the PDF into a write stream
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    
    // Add title
    doc.fontSize(16).font('Helvetica-Bold').text('Employee Shifts Report', {
      align: 'center'
    });
    
    doc.moveDown();
    
    // Add report date and parameters
    doc.fontSize(12).font('Helvetica');
    doc.text(`Report Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    doc.text(`Date Range: ${startDate || 'All'} to ${endDate || 'All'}`);
    doc.text(`Total Shifts: ${totalShifts}`);
    doc.text(`Completed Shifts: ${completedShifts}`);
    doc.text(`In-Progress Shifts: ${inProgressShifts}`);
    doc.text(`Total Work Hours: ${totalHours.toFixed(2)}`);
    
    doc.moveDown();
    
    // Table headers
    const tableTop = 200;
    const textOptions = { width: 500 };
    
    doc.font('Helvetica-Bold');
    doc.text('Employee', 30, tableTop, textOptions);
    doc.text('Date', 180, tableTop, textOptions);
    doc.text('Start - End', 250, tableTop, textOptions);
    doc.text('Hours', 350, tableTop, textOptions);
    doc.text('Status', 420, tableTop, textOptions);
    
    doc.moveTo(30, tableTop + 20).lineTo(565, tableTop + 20).stroke();
    
    // Table rows
    let rowTop = tableTop + 30;
    doc.font('Helvetica');
    
    shifts.forEach((shift, i) => {
      // Check if we need a new page
      if (rowTop > 750) {
        doc.addPage();
        rowTop = 50;
        
        // Repeat headers on new page
        doc.font('Helvetica-Bold');
        doc.text('Employee', 30, rowTop, textOptions);
        doc.text('Date', 180, rowTop, textOptions);
        doc.text('Start - End', 250, rowTop, textOptions);
        doc.text('Hours', 350, rowTop, textOptions);
        doc.text('Status', 420, rowTop, textOptions);
        
        doc.moveTo(30, rowTop + 20).lineTo(565, rowTop + 20).stroke();
        
        rowTop += 30;
        doc.font('Helvetica');
      }
      
      // Employee name (truncated if needed)
      const employeeName = `${shift.employee.firstName} ${shift.employee.lastName}`;
      doc.text(employeeName.substring(0, 20), 30, rowTop, textOptions);
      
      // Date
      doc.text(moment(shift.startTime).format('YYYY-MM-DD'), 180, rowTop, textOptions);
      
      // Start - End time
      const endTimeStr = shift.endTime ? moment(shift.endTime).format('HH:mm') : 'N/A';
      doc.text(`${moment(shift.startTime).format('HH:mm')} - ${endTimeStr}`, 250, rowTop, textOptions);
      
      // Hours
      doc.text(shift.workedHours ? shift.workedHours.toFixed(2) : 'N/A', 350, rowTop, textOptions);
      
      // Status
      doc.text(shift.status, 420, rowTop, textOptions);
      
      // Add a subtle divider line
      if (i < shifts.length - 1) {
        doc.moveTo(30, rowTop + 20).lineTo(565, rowTop + 20).stroke('#EEEEEE');
      }
      
      rowTop += 30;
    });
    
    // Footer
    doc.fontSize(10).text('End of Report', { align: 'center' });
    
    // Finalize the PDF
    doc.end();
    
    // Wait for the PDF to be created
    stream.on('finish', () => {
      // Send file for download
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          return res.status(500).json({
            success: false,
            error: 'Error downloading file',
            message: err.message
          });
        }
        
        // Delete the file after download
        fs.unlinkSync(filePath);
      });
    });
  } catch (error) {
    console.error('Error in exportToPDF:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Get current day's active shifts
 * @route GET /api/admin/shifts/active
 * @access Private/Admin
 */
exports.getActiveShifts = async (req, res) => {
  try {
    // Get today's start and end
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get all active shifts (in-progress or on-break)
    const activeShifts = await Shift.find({
      $and: [
        { startTime: { $gte: today } },
        { 
          $or: [
            { status: 'in-progress' },
            { status: 'on-break' }
          ]
        }
      ]
    })
    .populate('employee', 'firstName lastName email department employeeId')
    .sort({ startTime: -1 });
    
    res.status(200).json({
      success: true,
      count: activeShifts.length,
      data: activeShifts
    });
  } catch (error) {
    console.error('Error in getActiveShifts:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Get employee shift summary
 * @route GET /api/admin/employees/:id/summary
 * @access Private/Admin
 */
exports.getEmployeeSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    // Validate employee exists
    const employee = await User.findById(id).select('-password -refreshToken');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    // Build filter
    const filter = { employee: mongoose.Types.ObjectId(id) };
    
    if (startDate && endDate) {
      filter.startTime = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    
    // Get all employee shifts
    const shifts = await Shift.find(filter).sort({ startTime: -1 });
    
    // Calculate summary data
    const totalShifts = shifts.length;
    const completedShifts = shifts.filter(s => s.status === 'completed').length;
    
    // Calculate total hours
    const totalWorkHours = shifts.reduce((total, shift) => {
      return total + (shift.workedHours || 0);
    }, 0);
    
    // Calculate total break hours
    const totalBreakHours = shifts.reduce((total, shift) => {
      return total + (shift.breakDuration || 0);
    }, 0);
    
    // Calculate average shift length
    const averageShiftLength = completedShifts > 0 ? 
      totalWorkHours / completedShifts : 0;
    
    // Calculate average break time per shift
    const averageBreakTime = completedShifts > 0 ? 
      totalBreakHours / completedShifts : 0;
    
    // Get weekly hours breakdown (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const weeklyData = await Shift.aggregate([
      {
        $match: {
          employee: mongoose.Types.ObjectId(id),
          startTime: { $gte: fourWeeksAgo },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: '$startTime' },
            week: { $week: '$startTime' }
          },
          totalHours: { $sum: '$workedHours' },
          shiftsCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ]);
    
    // Format weekly data
    const formattedWeeklyData = weeklyData.map(week => {
      // Use the ISO week date system to get start date of the week
      const date = new Date(week._id.year, 0, 1 + (week._id.week - 1) * 7);
      return {
        weekStarting: moment(date).format('YYYY-MM-DD'),
        totalHours: Math.round(week.totalHours * 100) / 100,
        shiftsCount: week.shiftsCount
      };
    });
    
    // Get locations data
    const locations = shifts.map(shift => {
      return {
        date: moment(shift.startTime).format('YYYY-MM-DD'),
        startLocation: shift.startLocation,
        endLocation: shift.endLocation,
        shiftId: shift._id
      };
    });
    
    // Response data
    const summaryData = {
      employee: {
        id: employee._id,
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        department: employee.department,
        employeeId: employee.employeeId
      },
      summary: {
        totalShifts,
        completedShifts,
        totalWorkHours: Math.round(totalWorkHours * 100) / 100,
        totalBreakHours: Math.round(totalBreakHours * 100) / 100,
        averageShiftLength: Math.round(averageShiftLength * 100) / 100,
        averageBreakTime: Math.round(averageBreakTime * 100) / 100
      },
      weeklyData: formattedWeeklyData,
      locations
    };
    
    res.status(200).json({
      success: true,
      data: summaryData
    });
  } catch (error) {
    console.error('Error in getEmployeeSummary:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Get department summary
 * @route GET /api/admin/departments/summary
 * @access Private/Admin
 */
exports.getDepartmentSummary = async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.startTime = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    
    // Get all departments if none specified
    let departments = [];
    if (department) {
      departments = [department];
    } else {
      const deptResults = await User.distinct('department');
      departments = deptResults.filter(d => d && d.length > 0);
    }
    
    // Initialize result array
    const departmentSummaries = [];
    
    // Process each department
    for (const dept of departments) {
      // Get employees in department
      const employeesInDept = await User.find({ department: dept }).select('_id');
      const employeeIds = employeesInDept.map(e => e._id);
      
      if (employeeIds.length === 0) continue;
      
      // Build filter for shifts
      const shiftFilter = {
        ...dateFilter,
        employee: { $in: employeeIds }
      };
      
      // Get department shifts
      const shifts = await Shift.find(shiftFilter);
      
      // Calculate summary data
      const totalShifts = shifts.length;
      const completedShifts = shifts.filter(s => s.status === 'completed').length;
      
      // Calculate total hours
      const totalWorkHours = shifts.reduce((total, shift) => {
        return total + (shift.workedHours || 0);
      }, 0);
      
      // Calculate average per employee
      const avgHoursPerEmployee = employeeIds.length > 0 ? 
        totalWorkHours / employeeIds.length : 0;
      
      departmentSummaries.push({
        department: dept,
        employeeCount: employeeIds.length,
        totalShifts,
        completedShifts,
        totalWorkHours: Math.round(totalWorkHours * 100) / 100,
        avgHoursPerEmployee: Math.round(avgHoursPerEmployee * 100) / 100
      });
    }
    
    // Sort by total work hours (descending)
    departmentSummaries.sort((a, b) => b.totalWorkHours - a.totalWorkHours);
    
    res.status(200).json({
      success: true,
      count: departmentSummaries.length,
      data: departmentSummaries
    });
  } catch (error) {
    console.error('Error in getDepartmentSummary:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

/**
 * Manually add a shift for an employee (admin override)
 * @route POST /api/admin/shifts
 * @access Private/Admin
 */
exports.addShift = async (req, res) => {
  try {
    const {
      employeeId,
      startTime,
      endTime,
      startLocation,
      endLocation,
      breaks,
      notes,
      status = 'completed' // Default to completed for manual entries
    } = req.body;
    
    // Validate employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    // Calculate durations
    let totalDuration = 0;
    let breakDuration = 0;
    
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      totalDuration = (end - start) / (1000 * 60 * 60); // in hours
    }
    
    // Calculate break duration if breaks are provided
    if (breaks && breaks.length > 0) {
      breakDuration = breaks.reduce((total, breakItem) => {
        if (breakItem.startTime && breakItem.endTime) {
          const breakStart = new Date(breakItem.startTime);
          const breakEnd = new Date(breakItem.endTime);
          return total + ((breakEnd - breakStart) / (1000 * 60 * 60)); // in hours
        }
        return total;
      }, 0);
    }
    
    // Calculate worked hours
    const workedHours = totalDuration - breakDuration;
    
    // Create new shift
    const newShift = new Shift({
      employee: employeeId,
      startTime,
      endTime,
      startLocation,
      endLocation,
      breaks: breaks || [],
      totalDuration,
      breakDuration,
      workedHours,
      status,
      notes,
      adminCreated: true,
      createdBy: req.user._id
    });
    
    await newShift.save();
    
    // Populate employee info
    const createdShift = await Shift.findById(newShift._id)
      .populate('employee', 'firstName lastName email department');
    
    res.status(201).json({
      success: true,
      data: createdShift,
      message: 'Shift added successfully'
    });
  } catch (error) {
    console.error('Error in addShift:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};
// Add these methods to your existing adminController
exports.getUserById = async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
        .select('-password -refreshToken');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error in getUserById:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: error.message
      });
    }
  };
  
  exports.updateUser = async (req, res) => {
    try {
      const { firstName, lastName, email, department, role } = req.body;
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { firstName, lastName, email, department, role },
        { new: true, runValidators: true }
      ).select('-password -refreshToken');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Error in updateUser:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: error.message
      });
    }
  };
  
  exports.deleteUser = async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      if (user.role === 'admin') {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete admin users'
        });
      }
      
      await user.remove();
      
      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteUser:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: error.message
      });
    }
  };

module.exports = exports;