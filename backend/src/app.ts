import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js'; // Import our new routing layer
import resumeRoutes from './routes/resume.routes.js';
import matchRoutes from './routes/match.routes.js';
import materialRoutes from './routes/material.routes.js';

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourproductionfrontend.com'] 
    : ['http://localhost:3000'],             
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '2mb' })); 
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 🚀 Mount Core Authentication API Routes
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/materials', materialRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  console.error(`❌ [Error Handler] [${req.method} ${req.url}]:`, err);

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: process.env.NODE_ENV === 'production' ? 'A backend error occurred' : message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

export default app;
