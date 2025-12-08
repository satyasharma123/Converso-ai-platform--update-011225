import { Router } from 'express';
import linkedinMessagesRoutes from './linkedin.messages.routes';
import linkedinAccountsRoutes from './linkedin.accounts.routes';

const router = Router();

router.use('/', linkedinMessagesRoutes);
router.use('/', linkedinAccountsRoutes);

export default router;

