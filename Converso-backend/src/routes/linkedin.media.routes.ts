import { Router } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

const router = Router();

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

/**
 * LinkedIn Media Proxy
 * Resolves att:// attachment references with base64-encoded LinkedIn DM image URLs
 *
 * Endpoint:
 * GET /api/linkedin/media?url=att://...&account_id=...
 */
router.get('/', async (req, res) => {
  try {
    const rawUrl = req.query.url as string | undefined;
    const accountId = req.query.account_id as string | undefined;

    // =======================
    // AUDIT ONLY — DO NOT SHIP
    // =======================
    logger.info('[MEDIA AUDIT] rawUrl', { rawUrl });
    // =======================
    // END AUDIT
    // =======================

    if (!rawUrl || !accountId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!UNIPILE_API_KEY) {
      return res.status(500).json({ error: 'UNIPILE_API_KEY missing' });
    }

    if (!rawUrl.startsWith('att://')) {
      return res.status(400).json({ error: 'Invalid attachment reference' });
    }

    // att://<account_id>/<base64_encoded_https_url>
    const attRef = rawUrl.replace('att://', '');
    const parts = attRef.split('/', 2);

    // =======================
    // AUDIT ONLY — DO NOT SHIP
    // =======================
    logger.info('[MEDIA AUDIT] att parts', { parts });
    // =======================
    // END AUDIT
    // =======================

    if (parts.length !== 2) {
      return res.status(400).json({ error: 'Malformed att reference' });
    }

    const base64Payload = parts[1];

    // =======================
    // AUDIT ONLY — DO NOT SHIP
    // =======================
    const urlDecodedBase64 = decodeURIComponent(parts[1]);
    logger.info('[MEDIA AUDIT] urlDecodedBase64', { urlDecodedBase64 });
    // =======================
    // END AUDIT
    // =======================

    // CRITICAL FIX: URL-decode base64 payload before base64 decoding
    // Base64 strings in URLs may contain URL-encoded chars (%2F, %2B, %3D)
    // that need to be decoded before Buffer.from() can decode the base64
    let decodedUrl: string;
    try {
      const urlDecodedBase64Payload = decodeURIComponent(base64Payload);
      decodedUrl = Buffer.from(urlDecodedBase64Payload, 'base64').toString('utf-8');
    } catch (decodeError: any) {
      // If URL decode fails, try direct base64 decode (for non-URL-encoded base64)
      try {
        decodedUrl = Buffer.from(base64Payload, 'base64').toString('utf-8');
      } catch (base64Error: any) {
        logger.error('[MEDIA] Failed to decode base64 payload', {
          error: base64Error.message,
          base64PayloadLength: base64Payload.length,
        });
        return res.status(400).json({ error: 'Invalid base64 encoding in attachment reference' });
      }
    }

    // =======================
    // AUDIT ONLY — DO NOT SHIP
    // =======================
    logger.info('[MEDIA AUDIT] decodedUrl', { decodedUrl });
    // =======================
    // END AUDIT
    // =======================

    if (!decodedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid decoded media URL' });
    }

    const response = await axios.get(decodedUrl, {
      responseType: 'arraybuffer',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
      },
      params: {
        account_id: accountId,
      },
      timeout: 30000,
    });

    // =======================
    // AUDIT ONLY — DO NOT SHIP
    // =======================
    logger.info('[MEDIA AUDIT] upstream response', {
      status: response.status,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'],
    });
    // =======================
    // END AUDIT
    // =======================

    // Set Content-Type from upstream response
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Set Content-Length if available
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Set Content-Disposition for proper browser handling
    // For images, use 'inline' to display; for other files, use 'attachment' to download
    const isImage = contentType.startsWith('image/');
    const contentDisposition = isImage
      ? 'inline'
      : `attachment; filename="${response.headers['content-disposition']?.match(/filename="?([^"]+)"?/)?.[1] || 'attachment'}"`;
    res.setHeader('Content-Disposition', contentDisposition);

    return res.send(Buffer.from(response.data));
  } catch (err: any) {
    // =======================
    // AUDIT ONLY — DO NOT SHIP
    // =======================
    logger.error('[MEDIA AUDIT] Error fetching media', {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      upstreamUrl: err.config?.url,
    });
    // =======================
    // END AUDIT
    // =======================

    const statusCode = err.response?.status || 500;
    const errorMessage = err.response?.status === 404
      ? 'Media not found'
      : err.response?.status === 401 || err.response?.status === 403
      ? 'Unauthorized to access media'
      : 'Failed to load media';

    return res.status(statusCode).json({ error: errorMessage });
  }
});

export default router;
