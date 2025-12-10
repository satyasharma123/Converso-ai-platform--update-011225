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
import linkedinMessagesRoutes from './linkedin.messages.routes';
import linkedinAccountsRoutes from './linkedin.accounts.routes';
import linkedinWebhookRoutes from './linkedinWebhook.routes';
import linkedinSyncRoutes from './linkedin.sync.routes';
import linkedinFixRoutes from './linkedin.fix.routes';
import unipileWebhookRoutes from './unipile.webhook.routes';
import emailSyncRoutes from './emailSync.routes';
import emailTemplatesRoutes from './emailTemplates.routes';
import testRoutes from './test.routes';
import eventsRoutes from './events.routes';

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
router.use('/email-templates', emailTemplatesRoutes);
router.use('/linkedin/messages', linkedinMessagesRoutes);
// Mount accounts under /api/linkedin/... (no double "accounts" segment)
router.use('/linkedin', linkedinAccountsRoutes);
router.use('/linkedin/sync', linkedinSyncRoutes);
router.use('/linkedin/webhook', linkedinWebhookRoutes);
router.use('/linkedin/fix', linkedinFixRoutes);
router.use('/unipile/webhook', unipileWebhookRoutes);
router.use('/events', eventsRoutes);

// Test routes (remove in production)
if (process.env.NODE_ENV !== 'production') {
  router.use('/test', testRoutes);
}

export default router;