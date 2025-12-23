import { useAppSettings } from '@/hooks/useAppSettings';
import conversoLogo from '@/assets/converso-logo.png';

interface LogoProps {
  className?: string;
  alt?: string;
}

export function Logo({ className = 'h-12 w-auto', alt = 'SynQ' }: LogoProps) {
  const { data: settings, isLoading } = useAppSettings();
  
  // Use database logo if available, fallback to local asset
  const logoUrl = settings?.logo_url || conversoLogo;
  
  // If it's a URL (starts with http), use it directly
  // Otherwise, treat it as a local path
  const isExternalUrl = typeof logoUrl === 'string' && (logoUrl.startsWith('http') || logoUrl.startsWith('//'));
  
  if (isLoading) {
    return <div className={className} />;
  }

  if (isExternalUrl || logoUrl.startsWith('/')) {
    return <img src={logoUrl} alt={alt} className={className} />;
  }

  // Local asset import
  return <img src={logoUrl} alt={alt} className={className} />;
}

