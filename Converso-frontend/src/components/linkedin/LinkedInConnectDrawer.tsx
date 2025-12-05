/**
 * LinkedIn Connect Drawer
 * Secure LinkedIn account connection via OAuth
 */

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getLinkedInAuthUrl } from '@/api/linkedin';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProfile } from '@/hooks/useProfile';

interface LinkedInConnectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LinkedInConnectDrawer({ isOpen, onClose, onSuccess }: LinkedInConnectDrawerProps) {
  const { user } = useAuth();
  const { workspace, isLoading: workspaceLoading } = useWorkspace();
  const { data: profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  // Get workspace ID from workspace or profile fallback
  const workspaceId = workspace?.id || profile?.workspace_id;

  // Reset state when drawer opens
  useEffect(() => {
    if (isOpen) {
      setAuthUrl(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleConnect = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to connect a LinkedIn account');
      return;
    }

    // Wait a bit for workspace to load if still loading
    if (workspaceLoading && !workspaceId) {
      toast.info('Loading workspace information...');
      return;
    }

    if (!workspaceId) {
      toast.error('Workspace not found. Please refresh the page or contact support.');
      return;
    }

    setLoading(true);

    try {
      const response = await getLinkedInAuthUrl(workspaceId, user.id);
      setAuthUrl(response.url);

      // Open LinkedIn OAuth in new window
      const authWindow = window.open(
        response.url,
        'linkedin-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        toast.error('Please allow popups to connect your LinkedIn account');
        setLoading(false);
        return;
      }

      // Monitor the window for completion
      const checkWindow = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkWindow);
          setLoading(false);
          toast.info('Authentication window closed. Click "Refresh Accounts" to see your connected account.');
        }
      }, 1000);

      toast.success('LinkedIn authentication window opened. Complete the login process there.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start LinkedIn authentication');
      setLoading(false);
    }
  };

  const handleRefreshAccounts = async () => {
    if (!workspaceId) {
      toast.error('Workspace not found');
      return;
    }

    setLoading(true);

    try {
      // Import refresh function
      const { refreshLinkedInAccounts } = await import('@/api/linkedin');
      const result = await refreshLinkedInAccounts(workspaceId, user?.id);

      if (result.success) {
        toast.success(
          `Successfully synced ${result.synced} LinkedIn account${result.synced !== 1 ? 's' : ''}`
        );
        onSuccess();
        handleClose();
      } else {
        toast.error('Failed to refresh accounts');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh LinkedIn accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAuthUrl(null);
    setLoading(false);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Connect LinkedIn Account</SheetTitle>
          <SheetDescription>
            Connect your LinkedIn account securely to start managing messages
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {!authUrl ? (
            // Initial state: Show connect button
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your LinkedIn credentials are never stored by Converso. We use secure OAuth
                  authentication to connect your account.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-semibold text-sm">How it works:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Click "Connect LinkedIn Account" below</li>
                    <li>A new window will open with LinkedIn's secure login</li>
                    <li>Log in to your LinkedIn account in that window</li>
                    <li>Return here and click "Refresh Accounts"</li>
                    <li>Your LinkedIn account will appear in the list</li>
                  </ol>
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={loading || !user?.id || (workspaceLoading && !workspaceId)}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening authentication...
                    </>
                  ) : workspaceLoading && !workspaceId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading workspace...
                    </>
                  ) : !user?.id ? (
                    'Please log in first'
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect LinkedIn Account
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleRefreshAccounts}
                  disabled={loading || !workspaceId}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    'Refresh Accounts'
                  )}
                </Button>
                
                {!workspaceId && !workspaceLoading && user?.id && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription className="text-xs">
                      Workspace not found. Please refresh the page or contact support.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          ) : (
            // After auth URL generated: Show instructions
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Authentication window opened! Complete the LinkedIn login process in the new
                  window.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 space-y-3">
                <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                  Next Steps:
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
                  <li>Complete LinkedIn authentication in the popup window</li>
                  <li>Wait for the success message</li>
                  <li>Close the popup window</li>
                  <li>Click "Refresh Accounts" below to sync your account</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleRefreshAccounts} disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    'Refresh Accounts'
                  )}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                <p>
                  Didn't see the popup?{' '}
                  <button
                    onClick={() => authUrl && window.open(authUrl, '_blank')}
                    className="text-primary hover:underline"
                  >
                    Open authentication page
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
