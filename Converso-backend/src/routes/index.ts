import { Router } from 'express';
import conversationsRoutes from './conversations.routes';
import messagesRoutes from './messages.routes';
import pipelineStagesRoutes from './pipelineStages.routes';
import teamMembersRoutes from './teamMembers.routes';
import connectedAccountsRoutes from './connectedAccounts.routes';
import searchRoutes from './search.routes';
import analyticsRoutes from './analytics.routes';
import authRoutes from './auth.routes';
import passwordResetRoutes from './password-reset.routes';
import profilesRoutes from './profiles.routes';
import workspaceRoutes from './workspace.routes';
import routingRulesRoutes from './routingRules.routes';
import integrationsRoutes from './integrations.routes';
import emailSyncRoutes from './emailSync.routes';
import testRoutes from './test.routes';

const router = Router();

// Mount all route handlers
router.use('/conversations', conversationsRoutes);
router.use('/messages', messagesRoutes);
router.use('/pipeline-stages', pipelineStagesRoutes);
router.use('/team-members', teamMembersRoutes);
router.use('/connected-accounts', connectedAccountsRoutes);
router.use('/search', searchRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/auth', authRoutes);
router.use('/password-reset', passwordResetRoutes);
router.use('/profiles', profilesRoutes);
router.use('/workspace', workspaceRoutes);
router.use('/routing-rules', routingRulesRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/emails', emailSyncRoutes);

// Test routes (remove in production)
if (process.env.NODE_ENV !== 'production') {
  router.use('/test', testRoutes);
}

export default router;

