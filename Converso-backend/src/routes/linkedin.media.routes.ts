import { Router } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

const router = Router();

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || 'https://api.unipile.com/v1';

/**
 * LinkedIn Message Attachment Download
 * Fetches attachment using Unipile's official attachment API
 *
 * Endpoint:
 * GET /api/linkedin/media/messages/:message_id/attachments/:attachment_id
 */
router.get('/messages/:message_id/attachments/:attachment_id', async (req, res) => {
  try {
    const { message_id, attachment_id } = req.params;
    const account_id = req.query.account_id as string | undefined;

    if (!message_id || !attachment_id) {
      return res.status(400).json({ error: 'Missing message_id or attachment_id' });
    }

    if (!account_id) {
      return res.status(400).json({ error: 'Missing account_id parameter' });
    }

    if (!UNIPILE_API_KEY) {
      return res.status(500).json({ error: 'UNIPILE_API_KEY missing' });
    }

    // Call Unipile Attachment API
    const response = await axios.get(
      `${UNIPILE_BASE_URL}/messages/${encodeURIComponent(message_id)}/attachments/${encodeURIComponent(attachment_id)}`,
      {
        responseType: 'arraybuffer',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
        },
        params: {
          account_id: account_id,
        },
        timeout: 30000,
      }
    );

    // Set Content-Type from upstream response
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Set Content-Length if available
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Always use inline disposition
    res.setHeader('Content-Disposition', 'inline');

    return res.send(Buffer.from(response.data));
  } catch (err: any) {
    logger.error('[MEDIA] Error fetching attachment', {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      message_id: req.params.message_id,
      attachment_id: req.params.attachment_id,
    });

    const statusCode = err.response?.status || 500;
    const errorMessage = err.response?.status === 404
      ? 'Attachment not found'
      : err.response?.status === 401 || err.response?.status === 403
      ? 'Unauthorized to access attachment'
      : 'Failed to load attachment';

    return res.status(statusCode).json({ error: errorMessage });
  }
});

/**
 * LinkedIn Media Download by Media ID
 * Direct download using Unipile media_id
 *
 * Endpoint:
 * GET /api/linkedin/media/:media_id
 */
router.get('/:media_id', async (req, res) => {
  try {
    const mediaId = req.params.media_id;

    if (!mediaId) {
      return res.status(400).json({ error: 'Missing media_id parameter' });
    }

    if (!UNIPILE_API_KEY) {
      return res.status(500).json({ error: 'UNIPILE_API_KEY missing' });
    }

    // Call Unipile Media Download API
    const response = await axios.get(
      `https://api.unipile.com/v1/media/${encodeURIComponent(mediaId)}/download`,
      {
        responseType: 'arraybuffer',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
        },
        timeout: 30000,
      }
    );

    // Set Content-Type from upstream response
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Set Content-Length if available
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Always use inline disposition for direct media_id access
    res.setHeader('Content-Disposition', 'inline');

    return res.send(Buffer.from(response.data));
  } catch (err: any) {
    logger.error('[MEDIA] Error fetching media by media_id', {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      media_id: req.params.media_id,
    });

    const statusCode = err.response?.status || 500;
    const errorMessage = err.response?.status === 404
      ? 'Media not found'
      : err.response?.status === 401 || err.response?.status === 403
      ? 'Unauthorized to access media'
      : 'Failed to load media';

    return res.status(statusCode).json({ error: errorMessage });
  }
});

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

    // =======================
    // AUDIT ONLY — DO NOT SHIP
    // =======================
    logger.info('[MEDIA AUDIT] rawUrl', { rawUrl });
    // =======================
    // END AUDIT
    // =======================

    if (!rawUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    if (!UNIPILE_API_KEY) {
      return res.status(500).json({ error: 'UNIPILE_API_KEY missing' });
    }

    if (!rawUrl.startsWith('att://')) {
      return res.status(400).json({ error: 'Invalid attachment reference' });
    }

    // att://<unipile_account_id>/<base64_encoded_https_url>
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

    const unipileAccountIdFromAtt = parts[0];
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

    const response = await axios.get(
      'https://api.unipile.com/v1/media/download',
      {
        responseType: 'arraybuffer',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
        },
        params: {
          account_id: unipileAccountIdFromAtt,
          url: decodedUrl,
        },
        timeout: 30000,
      }
    );

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
