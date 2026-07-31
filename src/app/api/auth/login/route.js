import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { rateLimit, resetRateLimit } from '@/lib/rateLimit';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { success: false, message: 'Identifiant et mot de passe requis' },
        { status: 400 }
      );
    }

    // Protection brute-force : limite les tentatives par IP et par identifiant.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rlIp = rateLimit(`login:ip:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    const rlUser = rateLimit(`login:user:${userId}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rlIp.allowed || !rlUser.allowed) {
      const retryAfter = Math.max(rlIp.retryAfter, rlUser.retryAfter);
      return NextResponse.json(
        { success: false, message: 'Trop de tentatives de connexion. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ? AND actif = 1',
      args: [userId]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Identifiants incorrects' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.mot_de_passe);

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: 'Identifiants incorrects' },
        { status: 401 }
      );
    }

    // Connexion réussie : on efface les compteurs de tentatives.
    resetRateLimit(`login:user:${userId}`);

    const token = generateToken(user.id, user.type_utilisateur);

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        type: user.type_utilisateur,
        niveau_validation: user.niveau_validation || 0,
        requirePasswordChange: user.mot_de_passe_temporaire === 1
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la connexion' },
      { status: 500 }
    );
  }
}
