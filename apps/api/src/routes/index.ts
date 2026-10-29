import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { authRouter } from './auth.routes.js';
import { institutionRouter } from './institution.routes.js';
import { apaarRouter } from './apaar.routes.js';
import { mlRouter } from './ml.routes.js';

export const apiRouter: RouterType = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/institution', institutionRouter);
apiRouter.use('/apaar', apaarRouter);
apiRouter.use('/ml', mlRouter);
