import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { adjustment, motif, type } = await request.json();

    if (adjustment === undefined || adjustment === null || adjustment === 0) {
      return NextResponse.json(
        { success: false, message: 'Le nombre de jours à ajuster est requis et doit être différent de 0' },
        { status: 400 }
      );
    }

    const adjustmentNum = parseFloat(adjustment);
    if (isNaN(adjustmentNum)) {
      return NextResponse.json(
        { success: false, message: 'Le nombre de jours doit être un nombre valide' },
        { status: 400 }
      );
    }

    const adjustType = type === 'conges' ? 'conges' : 'compensateurs';
    const currentYear = new Date().getFullYear();

    // Vérifier que l'utilisateur existe
    const userResult = await db.execute({
      sql: 'SELECT id, nom, prenom FROM users WHERE id = ?',
      args: [id]
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Récupérer le solde actuel
    const balanceResult = await db.execute({
      sql: 'SELECT * FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [id, currentYear]
    });

    if (balanceResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Aucun solde de congés trouvé pour cette année' },
        { status: 404 }
      );
    }

    const balance = balanceResult.rows[0];
    const newRestants = parseFloat(balance.jours_restants) + adjustmentNum;

    if (newRestants < 0) {
      return NextResponse.json(
        { success: false, message: `Impossible : le solde restant deviendrait négatif (${newRestants.toFixed(2)} jours)` },
        { status: 400 }
      );
    }

    const user = userResult.rows[0];
    let message;

    if (adjustType === 'compensateurs') {
      const currentComp = parseFloat(balance.jours_compensateurs || 0);
      let newCompensateurs = currentComp + adjustmentNum;
      let newAcquis = parseFloat(balance.jours_acquis || 0);

      // Si les compensateurs passeraient en négatif, on prend le surplus sur les jours acquis
      if (newCompensateurs < 0) {
        const surplus = Math.abs(newCompensateurs);
        newCompensateurs = 0;
        newAcquis = newAcquis - surplus;
      }

      await db.execute({
        sql: 'UPDATE soldes_conges SET jours_compensateurs = ?, jours_acquis = ?, jours_restants = ? WHERE user_id = ? AND annee = ?',
        args: [newCompensateurs, newAcquis, newRestants, id, currentYear]
      });

      const detail = currentComp + adjustmentNum < 0
        ? ` (${currentComp} comp. → 0, ${Math.abs(currentComp + adjustmentNum).toFixed(2)} déduit des acquis)`
        : '';
      message = `Jours compensateurs ajustés : ${adjustmentNum > 0 ? '+' : ''}${adjustmentNum} jour(s)${detail}`;
      console.log(`Compensatory days adjusted for ${user.prenom} ${user.nom}: ${adjustmentNum > 0 ? '+' : ''}${adjustmentNum} days (motif: ${motif || 'non spécifié'})`);
    } else {
      const newAcquis = parseFloat(balance.jours_acquis || 0) + adjustmentNum;

      if (newAcquis < 0) {
        return NextResponse.json(
          { success: false, message: `Impossible : les jours acquis deviendraient négatifs (${newAcquis.toFixed(2)} jours)` },
          { status: 400 }
        );
      }

      await db.execute({
        sql: 'UPDATE soldes_conges SET jours_acquis = ?, jours_restants = ? WHERE user_id = ? AND annee = ?',
        args: [newAcquis, newRestants, id, currentYear]
      });

      message = `Jours de congés ajustés : ${adjustmentNum > 0 ? '+' : ''}${adjustmentNum} jour(s)`;
      console.log(`Leave days adjusted for ${user.prenom} ${user.nom}: ${adjustmentNum > 0 ? '+' : ''}${adjustmentNum} days (motif: ${motif || 'non spécifié'})`);
    }

    return NextResponse.json({
      success: true,
      message,
      newBalance: {
        jours_restants: newRestants
      }
    });
  } catch (error) {
    console.error('Error adjusting balance:', error);
    return NextResponse.json(
      { success: false, message: `Erreur: ${error.message}` },
      { status: 500 }
    );
  }
}
