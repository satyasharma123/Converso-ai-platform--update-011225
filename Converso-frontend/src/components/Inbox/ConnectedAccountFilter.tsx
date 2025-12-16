import { Mail, Linkedin, Inbox } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";

interface ConnectedAccountFilterProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'email' | 'linkedin';
}

export function ConnectedAccountFilter({ value, onChange, type }: ConnectedAccountFilterProps) {
  const { data: accounts, isLoading } = useConnectedAccounts();

  const filteredAccounts = type 
    ? accounts?.filter(acc => acc.account_type === type)
    : accounts;

  if (isLoading || !filteredAccounts?.length) {
    return null;
  }

  // Find the selected account to display properly
  const selectedAccount = value === 'all' ? null : filteredAccounts.find(acc => acc.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full h-8 text-xs">
        <div className="flex items-center gap-2">
          <Inbox className="h-3.5 w-3.5" />
          <SelectValue placeholder="All Accounts" className="text-xs placeholder:text-xs">
            {selectedAccount ? selectedAccount.account_name : "All Accounts"}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border shadow-md z-50">
        <SelectItem value="all" className="text-xs">All Accounts</SelectItem>
        {filteredAccounts.map(account => (
          <SelectItem key={account.id} value={account.id} className="text-xs">
            <div className="flex items-center gap-2">
              {account.account_type === 'email' ? (
                <Mail className="h-3 w-3" />
              ) : (
                <Linkedin className="h-3 w-3" />
              )}
              <span>{account.account_name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
