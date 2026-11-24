import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif']);

/**
 * GET /api/users/:id/photo — photo de profil en binaire.
 * L'URL est versionnée (?v=…, voir lib/photo.js), d'où le cache long.
 */
export async function GET(request, { params }) {
  const { authenticated } = await requireAuth();
  if (!authenticated) return new Response(null, { status: 401 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) return new Response(null, { status: 400 });

  const result = await db.execute({
    sql: 'SELECT photo_profil FROM users WHERE id = ?',
    args: [userId],
  });
  const dataUrl = result.rows[0]?.photo_profil;
  const match = typeof dataUrl === 'string' && /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return new Response(null, { status: 404 });

  const mime = match[1].toLowerCase();
  if (!ALLOWED.has(mime)) return new Response(null, { status: 415 });

  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': mime === 'image/jpg' ? 'image/jpeg' : mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
