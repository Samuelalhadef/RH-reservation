import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { photo } = await request.json();

    if (!photo) {
      return NextResponse.json(
        { success: false, message: 'Photo manquante' },
        { status: 400 }
      );
    }

    // Vérifier que c'est bien une image base64
    if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, message: 'Format d\'image invalide' },
        { status: 400 }
      );
    }

    // Limite de taille (~1 Mo en base64) pour éviter la saturation de la base.
    // Le navigateur réduit la photo à 400 × 400 px avant l'envoi (≈ 50 ko).
    if (photo.length > 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'Image trop volumineuse (1 Mo maximum)' },
        { status: 400 }
      );
    }

    // Sauvegarder la photo
    await db.execute({
      sql: 'UPDATE users SET photo_profil = ? WHERE id = ?',
      args: [photo, user.userId]
    });

    return NextResponse.json({
      success: true,
      message: 'Photo de profil mise à jour'
    });
  } catch (error) {
    console.error('Error updating photo:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la mise à jour de la photo' },
      { status: 500 }
    );
  }
}
