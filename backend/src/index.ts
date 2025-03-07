// backend\src\index.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import env from './config/env.js';
import authRoutes from './routes/auth.js';
import emailRoutes from './routes/emails.js';
import aiRoutes from './routes/ai.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: env.NODE_ENV === 'production' ? env.FRONTEND_LIVE_URL : env.FRONTEND_URL,
  credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);

// Error handling
app.use(errorHandler);

// Database connection
mongoose.connect(env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});