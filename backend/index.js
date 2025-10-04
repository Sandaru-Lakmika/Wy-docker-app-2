const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());

// MySQL database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql_db',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'carservice',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create tables if not exists
async function initDb() {
  try {
    const connection = await pool.getConnection();
    
    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create bookings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        service_type VARCHAR(255) NOT NULL,
        vehicle_type VARCHAR(100) NOT NULL,
        vehicle_model VARCHAR(255) NOT NULL,
        preferred_date DATE NOT NULL,
        preferred_time VARCHAR(20) NOT NULL,
        description TEXT,
        status ENUM('Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    connection.release();
    console.log('MySQL database and tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDb();

// Sign Up endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, confirmPassword, mobileNumber } = req.body;

    if (!username || !password || !confirmPassword || !mobileNumber) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, password, mobile_number) VALUES (?, ?, ?)',
      [username, hashedPassword, mobileNumber]
    );

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Sign up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign In endpoint
app.post('/api/signin', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Create booking endpoint
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { serviceType, vehicleType, vehicleModel, preferredDate, preferredTime, description } = req.body;
    const userId = req.user.userId;

    if (!serviceType || !vehicleType || !vehicleModel || !preferredDate || !preferredTime) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const [result] = await pool.query(
      `INSERT INTO bookings (user_id, service_type, vehicle_type, vehicle_model, preferred_date, preferred_time, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, serviceType, vehicleType, vehicleModel, preferredDate, preferredTime, description || '']
    );

    // Get the created booking
    const [booking] = await pool.query(
      'SELECT * FROM bookings WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'Booking created successfully',
      booking: booking[0]
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user bookings endpoint
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [bookings] = await pool.query(
      `SELECT id, service_type, vehicle_type, vehicle_model, preferred_date, preferred_time, description, status, created_at 
       FROM bookings WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    // Format the response
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      serviceType: booking.service_type,
      vehicleType: booking.vehicle_type,
      vehicleModel: booking.vehicle_model,
      date: booking.preferred_date,
      time: booking.preferred_time,
      description: booking.description,
      status: booking.status,
      createdAt: booking.created_at
    }));

    res.json(formattedBookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update booking status endpoint
app.put('/api/bookings/:id/status', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { status } = req.body;
    const userId = req.user.userId;

    if (!status || !['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if booking belongs to user
    const [bookings] = await pool.query(
      'SELECT id FROM bookings WHERE id = ? AND user_id = ?',
      [bookingId, userId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await pool.query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, bookingId]
    );

    res.json({ message: 'Booking status updated successfully' });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel booking endpoint
app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.userId;

    // Check if booking belongs to user
    const [bookings] = await pool.query(
      'SELECT id FROM bookings WHERE id = ? AND user_id = ?',
      [bookingId, userId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await pool.query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      ['Cancelled', bookingId]
    );

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get booking statistics endpoint
app.get('/api/bookings/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [stats] = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM bookings WHERE user_id = ?`,
      [userId]
    );

    res.json(stats[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users endpoint (for testing)
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, mobile_number, created_at FROM users');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});