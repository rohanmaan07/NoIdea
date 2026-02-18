require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorHandler = require('./middleware/errorHandler');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

app.get('/testing', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/users', userRoutes);
app.use("/api/websites", websiteRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

const PORT = process.env.PORT;
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server due to DB error:', error.message);
    process.exit(1);
  });

