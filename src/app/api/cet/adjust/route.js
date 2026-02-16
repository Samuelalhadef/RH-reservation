import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

export async function POST(request) {
  try {
    const { authorized, user } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { user_id, jours, motif } = await request.json();

    if (!user_id || !jours || isNaN(parseFloat(jours)) || parseFloat(jours) === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur et nombre de jours requis' },
        { status: 400 }
      );
    }

    const joursValue = parseFloat(jours);

    // Vérifier que l'utilisateur existe
    const userResult = await db.execute({
      sql: 'SELECT id, nom, prenom FROM users WHERE id = ? AND actif = 1',
      args: [user_id]
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    // Récupérer ou créer le CET
    const cetResult = await db.execute({
      sql: 'SELECT solde FROM cet WHERE user_id = ?',
      args: [user_id]
    });

    let currentSolde = 0;
    if (cetResult.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO cet (user_id, solde) VALUES (?, 0)',
        args: [user_id]
      });
    } else {
      currentSolde = cetResult.rows[0].solde || 0;
    }

    const newSolde = currentSolde + joursValue;

    if (newSolde < 0) {
      return NextResponse.json(
        { success: false, message: `Solde insuffisant. Solde actuel : ${currentSolde} jours` },
        { status: 400 }
      );
    }

    if (newSolde > 60) {
      return NextResponse.json(
        { success: false, message: `Le solde CET ne peut pas dépasser 60 jours. Solde actuel : ${currentSolde}, maximum ajustable : ${60 - currentSolde}` },
        { status: 400 }
      );
    }

    // Mettre à jour le solde CET
    await db.execute({
      sql: 'UPDATE cet SET solde = ? WHERE user_id = ?',
      args: [newSolde, user_id]
    });

    // Enregistrer dans l'historique
    const type = joursValue > 0 ? 'credit' : 'debit';
    const motifFinal = motif || (joursValue > 0 ? 'Ajustement RH (crédit)' : 'Ajustement RH (retrait)');

    await db.execute({
      sql: 'INSERT INTO cet_historique (user_id, type, jours, motif) VALUES (?, ?, ?, ?)',
      args: [user_id, type, Math.abs(joursValue), motifFinal]
    });

    const agent = userResult.rows[0];
    return NextResponse.json({
      success: true,
      message: `CET de ${agent.prenom} ${agent.nom} ajusté : ${currentSolde} → ${newSolde} jours`
    });
  } catch (error) {
    console.error('Error adjusting CET:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de l\'ajustement du CET' },
      { status: 500 }
    );
  }
}
