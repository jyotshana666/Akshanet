import './types.js';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/index.js';
import { config } from './config.js';

const app: Express = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/api/v1', apiRouter);

app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.API_PORT, () => {
  console.log(`API server running on port ${config.API_PORT}`);
});

export { app };
