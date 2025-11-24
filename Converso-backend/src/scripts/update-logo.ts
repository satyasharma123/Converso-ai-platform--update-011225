/**
 * Script to update logo and icon URLs in database
 * 
 * Usage:
 * 1. Upload images to Supabase Storage first
 * 2. Get the public URLs
 * 3. Run: tsx src/scripts/update-logo.ts <logo_url> <icon_url>
 * 
 * Or update manually in Supabase SQL Editor
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

async function updateLogo(logoUrl?: string, iconUrl?: string) {
  logger.info('🖼️  Updating logo and icon URLs...');

  try {
    if (logoUrl) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert(
          { setting_key: 'logo_url', setting_value: logoUrl },
          { onConflict: 'setting_key' }
        );

      if (error) {
        logger.error('Failed to update logo URL:', error);
      } else {
        logger.info(`✅ Logo URL updated: ${logoUrl}`);
      }
    }

    if (iconUrl) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert(
          { setting_key: 'icon_url', setting_value: iconUrl },
          { onConflict: 'setting_key' }
        );

      if (error) {
        logger.error('Failed to update icon URL:', error);
      } else {
        logger.info(`✅ Icon URL updated: ${iconUrl}`);
      }
    }

    if (!logoUrl && !iconUrl) {
      logger.info('No URLs provided. Usage:');
      logger.info('  tsx src/scripts/update-logo.ts <logo_url> <icon_url>');
      logger.info('');
      logger.info('Example:');
      logger.info('  tsx src/scripts/update-logo.ts "https://example.com/logo.png" "https://example.com/icon.png"');
    }

    logger.info('✅ Update completed!');
  } catch (error: any) {
    logger.error('❌ Update failed:', error);
    throw error;
  }
}

// Get command line arguments
const logoUrl = process.argv[2];
const iconUrl = process.argv[3];

if (require.main === module) {
  updateLogo(logoUrl, iconUrl)
    .then(() => {
      logger.info('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

export { updateLogo };

