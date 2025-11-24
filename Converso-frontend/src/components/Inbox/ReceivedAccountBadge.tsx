import { Badge } from "@/components/ui/badge";
import { Mail, Linkedin } from "lucide-react";

interface ReceivedAccountBadgeProps {
  accountName: string;
  accountEmail?: string;
  accountType: string;
}

export function ReceivedAccountBadge({ 
  accountName, 
  accountEmail, 
  accountType 
}: ReceivedAccountBadgeProps) {
  const isEmail = accountType === 'email';
  
  return (
    <Badge 
      variant="outline" 
      className="text-[9px] h-3.5 px-1 flex items-center gap-1"
      title={accountEmail || accountName}
    >
      {isEmail ? (
        <Mail className="h-3 w-3" />
      ) : (
        <Linkedin className="h-3 w-3" />
      )}
      <span className="truncate max-w-[120px]">{accountName}</span>
    </Badge>
  );
}
