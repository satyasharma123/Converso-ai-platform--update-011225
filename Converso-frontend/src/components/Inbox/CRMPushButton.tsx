import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface CRMPushButtonProps {
  conversationId: string;
  leadData: {
    name: string;
    email?: string;
    status: string;
  };
}

export function CRMPushButton({ conversationId, leadData }: CRMPushButtonProps) {
  const handlePushToCRM = async () => {
    // Placeholder for CRM integration
    toast.info('CRM Integration Coming Soon', {
      description: 'This feature will push lead data to your CRM (HubSpot, Salesforce, Pipedrive)',
    });

    // Future implementation:
    // try {
    //   const response = await fetch('/api/crm/pushLead', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       conversationId,
    //       leadData,
    //     }),
    //   });
    //   
    //   if (response.ok) {
    //     toast.success('Lead pushed to CRM successfully');
    //   } else {
    //     throw new Error('Failed to push to CRM');
    //   }
    // } catch (error) {
    //   toast.error('Failed to push lead to CRM');
    // }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handlePushToCRM}
      className="gap-2"
    >
      <Upload className="h-4 w-4" />
      Push to CRM
    </Button>
  );
}
