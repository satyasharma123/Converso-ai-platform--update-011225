import { Loader2 } from "lucide-react";
import { useIsEmailSyncInProgress } from "@/hooks/useEmailSync";

export function SyncBanner() {
  const isSyncing = useIsEmailSyncInProgress();

  if (!isSyncing) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Sync in progress… Fetching latest emails</span>
      </div>
    </div>
  );
}

