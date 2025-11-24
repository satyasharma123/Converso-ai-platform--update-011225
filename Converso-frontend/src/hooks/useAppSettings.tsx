import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  logo_url: string;
  icon_url: string;
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['app_settings'],
    queryFn: async (): Promise<AppSettings> => {
      try {
        // Use type assertion since app_settings table exists but may not be in generated types
        const { data, error } = await (supabase as any)
          .from('app_settings')
          .select('setting_key, setting_value');

        // If table doesn't exist (404) or other error, return defaults
        if (error) {
          // Table doesn't exist yet (404) - return defaults silently
          if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
            return {
              logo_url: '/assets/converso-logo.png',
              icon_url: '/assets/converso-icon.png',
            };
          }
          // For other errors, still return defaults but don't log (to avoid console spam)
          return {
            logo_url: '/assets/converso-logo.png',
            icon_url: '/assets/converso-icon.png',
          };
        }

        const settings: Partial<AppSettings> = {};
        (data || []).forEach((item: any) => {
          const { setting_key, setting_value } = item;
          if (setting_key === 'logo_url') {
            settings.logo_url = setting_value || '/assets/converso-logo.png';
          } else if (setting_key === 'icon_url') {
            settings.icon_url = setting_value || '/assets/converso-icon.png';
          }
        });

        return {
          logo_url: settings.logo_url || '/assets/converso-logo.png',
          icon_url: settings.icon_url || '/assets/converso-icon.png',
        };
      } catch (error) {
        // Return defaults on any error
        return {
          logo_url: '/assets/converso-logo.png',
          icon_url: '/assets/converso-icon.png',
        };
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry if table doesn't exist
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid spam
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Use type assertion since app_settings table exists but may not be in generated types
      const { error } = await (supabase as any)
        .from('app_settings')
        .upsert({ setting_key: key, setting_value: value }, { onConflict: 'setting_key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
    },
  });
}

