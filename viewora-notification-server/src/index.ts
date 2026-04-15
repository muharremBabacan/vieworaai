import express, { Request, Response, NextFunction } from 'express';
// @ts-ignore
import cors from 'cors';
import notificationRoutes from './routes/notification';

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Middleware
app.use(cors());
app.use(express.json());

// 2. Routes
app.use('/api', notificationRoutes);

// 3. Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Notification Server is Running!' });
});

// 4. Error Handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Internal Error]', err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// 5. Start Server
app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`🚀 VIEWora Notification Server Running at: http://localhost:${PORT}`);
    console.log(`📍 Endpoints Base Path: /api`);
    console.log('--------------------------------------------------');
});
