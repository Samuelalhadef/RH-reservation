import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireRH } from '@/lib/auth';
import {
  calculateBusinessDays,
  isAtLeast7DaysInAdvance,
  formatDateFR
} from '@/lib/dateUtils';
import { sendNewLeaveRequestEmail } from '@/lib/email';
import { notifyLeaveRequest, sendPushToRH } from '@/lib/pushNotifications';

export async function GET(request) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const year = searchParams.get('year');

    let sql = `
      SELECT dc.*, u.nom, u.prenom, u.email, u.type_utilisateur, u.responsable_id,
             v.nom as validateur_nom, v.prenom as validateur_prenom,
             v1.nom as validateur_n1_nom, v1.prenom as validateur_n1_prenom,
             v2.nom as validateur_n2_nom, v2.prenom as validateur_n2_prenom,
             resp.nom as responsable_nom, resp.prenom as responsable_prenom,
             resp2.nom as responsable_n2_nom, resp2.prenom as responsable_n2_prenom
      FROM demandes_conges dc
      JOIN users u ON dc.user_id = u.id
      LEFT JOIN users v ON dc.validateur_id = v.id
      LEFT JOIN users v1 ON dc.validateur_niveau_1_id = v1.id
      LEFT JOIN users v2 ON dc.validateur_niveau_2_id = v2.id
      LEFT JOIN users resp ON u.responsable_id = resp.id
      LEFT JOIN users resp2 ON resp.responsable_id = resp2.id
      WHERE 1=1
    `;
    const args = [];

    // Filtrer par année seulement si spécifié
    if (year) {
      sql += ' AND strftime(\'%Y\', dc.date_debut) = ?';
      args.push(year.toString());
    }

    if (userId) {
      sql += ' AND dc.user_id = ?';
      args.push(userId);
    }

    if (status) {
      sql += ' AND dc.statut = ?';
      args.push(status);
    }

    sql += ' ORDER BY dc.date_demande DESC';

    const result = await db.execute({ sql, args });

    return NextResponse.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des demandes' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    console.log('Auth result:', { authenticated, user });

    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { date_debut, date_fin, motif, type_debut, type_fin } = await request.json();
    console.log('Request data:', { date_debut, date_fin, motif, type_debut, type_fin, userId: user.userId });

    if (!date_debut || !date_fin) {
      return NextResponse.json(
        { success: false, message: 'Les dates de début et de fin sont requises' },
        { status: 400 }
      );
    }

    if (new Date(date_debut) > new Date(date_fin)) {
      return NextResponse.json(
        { success: false, message: 'La date de début doit être avant la date de fin' },
        { status: 400 }
      );
    }

    if (!isAtLeast7DaysInAdvance(date_debut)) {
      return NextResponse.json(
        { success: false, message: 'Les demandes doivent être faites au moins 7 jours à l\'avance' },
        { status: 400 }
      );
    }

    const holidaysResult = await db.execute({
      sql: `SELECT date FROM jours_feries WHERE date >= ? AND date <= ?`,
      args: [date_debut, date_fin]
    });
    const holidays = holidaysResult.rows.map(row => row.date);

    let businessDays = calculateBusinessDays(date_debut, date_fin, holidays);

    // Ajuster pour les demi-journées
    const isSameDay = date_debut === date_fin;
    const typeDebutValue = type_debut || 'journee_complete';
    const typeFinValue = type_fin || 'journee_complete';

    if (isSameDay) {
      if (typeDebutValue === 'matin' && typeFinValue === 'apres_midi') {
        businessDays = 1;
      } else if (typeDebutValue === 'matin' || typeDebutValue === 'apres_midi') {
        businessDays = 0.5;
      }
    } else {
      if (typeDebutValue === 'apres_midi') {
        businessDays -= 0.5;
      }
      if (typeFinValue === 'matin') {
        businessDays -= 0.5;
      }
    }

    businessDays = Math.max(0, businessDays);

    if (businessDays === 0) {
      return NextResponse.json(
        { success: false, message: 'La période sélectionnée ne contient aucun jour ouvré' },
        { status: 400 }
      );
    }

    // Utiliser user.userId ou user.id selon ce qui est disponible
    const userId = user.userId || user.id;
    console.log('Using userId:', userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Impossible de récupérer l\'ID utilisateur' },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const balanceResult = await db.execute({
      sql: 'SELECT jours_restants FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [userId, currentYear]
    });

    console.log('Balance result:', balanceResult);

    let joursRestants = 25;

    if (!balanceResult.rows || balanceResult.rows.length === 0) {
      console.log('Creating new balance entry for user:', userId);
      await db.execute({
        sql: `
          INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants)
          VALUES (?, ?, 25, 0, 25)
        `,
        args: [userId, currentYear]
      });
      joursRestants = 25;
    } else {
      joursRestants = balanceResult.rows[0].jours_restants;
    }

    console.log('Jours restants:', joursRestants);

    if (businessDays > joursRestants) {
      return NextResponse.json(
        { success: false, message: `Solde insuffisant. Vous avez ${joursRestants} jour(s) disponible(s)` },
        { status: 400 }
      );
    }

    // Vérifier les chevauchements avec d'autres demandes VALIDÉES uniquement
    const validatedOverlapResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM demandes_conges
        WHERE user_id = ? AND statut = 'validee'
        AND ((date_debut <= ? AND date_fin >= ?)
             OR (date_debut <= ? AND date_fin >= ?)
             OR (date_debut >= ? AND date_fin <= ?))
      `,
      args: [userId, date_fin, date_debut, date_debut, date_debut, date_debut, date_fin]
    });

    if (validatedOverlapResult.rows[0].count > 0) {
      return NextResponse.json(
        { success: false, message: 'Vous avez déjà une demande validée sur cette période. Vous ne pouvez pas la modifier.' },
        { status: 400 }
      );
    }

    // Supprimer automatiquement les demandes EN ATTENTE qui chevauchent
    const pendingOverlapResult = await db.execute({
      sql: `
        SELECT id, date_debut, date_fin FROM demandes_conges
        WHERE user_id = ? AND statut = 'en_attente'
        AND ((date_debut <= ? AND date_fin >= ?)
             OR (date_debut <= ? AND date_fin >= ?)
             OR (date_debut >= ? AND date_fin <= ?))
      `,
      args: [userId, date_fin, date_debut, date_debut, date_debut, date_debut, date_fin]
    });

    // Supprimer les demandes en attente qui chevauchent
    let deletedCount = 0;
    if (pendingOverlapResult.rows && pendingOverlapResult.rows.length > 0) {
      for (const pendingLeave of pendingOverlapResult.rows) {
        await db.execute({
          sql: 'DELETE FROM demandes_conges WHERE id = ?',
          args: [pendingLeave.id]
        });
        deletedCount++;
      }
      console.log(`Supprimé ${deletedCount} demande(s) en attente qui chevauchaient`);
    }

    const result = await db.execute({
      sql: `
        INSERT INTO demandes_conges (user_id, date_debut, date_fin, nombre_jours_ouvres, type_debut, type_fin, motif, statut)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')
      `,
      args: [userId, date_debut, date_fin, businessDays, typeDebutValue, typeFinValue, motif || null]
    });

    const userResult = await db.execute({
      sql: 'SELECT nom, prenom FROM users WHERE id = ?',
      args: [userId]
    });

    console.log('User result:', userResult);

    if (!userResult.rows || userResult.rows.length === 0) {
      console.error('User not found:', userId);
      return NextResponse.json(
        { success: false, message: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    const userData = userResult.rows[0];
    console.log('User data:', userData);

    // Envoyer notification au bon validateur selon la hiérarchie
    try {
      // Récupérer les infos complètes de l'utilisateur (avec responsable_id)
      const fullUserResult = await db.execute({
        sql: 'SELECT responsable_id FROM users WHERE id = ?',
        args: [userId]
      });

      const hasResponsable = fullUserResult.rows[0]?.responsable_id;

      if (hasResponsable) {
        // L'utilisateur a un responsable direct, lui envoyer la notification
        const responsableResult = await db.execute({
          sql: 'SELECT email, nom, prenom FROM users WHERE id = ?',
          args: [hasResponsable]
        });

        console.log('Responsable found:', responsableResult.rows?.length || 0);

        if (responsableResult.rows && responsableResult.rows.length > 0) {
          const responsable = responsableResult.rows[0];
          try {
            await sendNewLeaveRequestEmail(
              responsable.email,
              `${userData.prenom} ${userData.nom}`,
              formatDateFR(date_debut),
              formatDateFR(date_fin),
              businessDays
            );
            console.log(`Email envoyé au responsable: ${responsable.prenom} ${responsable.nom}`);
          } catch (emailError) {
            console.error('Error sending email to responsable:', emailError);
          }
          // Notification push au responsable
          try {
            await notifyLeaveRequest(`${userData.prenom} ${userData.nom}`, hasResponsable, Number(result.lastInsertRowid));
          } catch (e) { /* ignore push errors */ }
        }
      } else {
        // Pas de responsable direct, envoyer à la RH
        const rhResult = await db.execute({
          sql: 'SELECT email FROM users WHERE type_utilisateur IN ("RH", "Direction") AND actif = 1'
        });

        console.log('RH found:', rhResult.rows?.length || 0);

        if (rhResult.rows && rhResult.rows.length > 0) {
          for (const rh of rhResult.rows) {
            try {
              await sendNewLeaveRequestEmail(
                rh.email,
                `${userData.prenom} ${userData.nom}`,
                formatDateFR(date_debut),
                formatDateFR(date_fin),
                businessDays
              );
            } catch (emailError) {
              console.error('Error sending email to RH:', emailError);
            }
          }
        }
        // Notification push aux RH
        try {
          await sendPushToRH({
            title: 'Nouvelle demande de congé',
            body: `${userData.prenom} ${userData.nom} a fait une demande de congé`,
            url: '/validation',
            tag: `leave-${Number(result.lastInsertRowid)}`
          });
        } catch (e) { /* ignore push errors */ }
      }
    } catch (emailError) {
      console.error('Error in email process:', emailError);
      // Ne pas bloquer la création de la demande si l'email échoue
    }

    let successMessage = 'Demande de congés créée avec succès';
    if (deletedCount > 0) {
      successMessage += ` (${deletedCount} demande(s) en attente remplacée(s))`;
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      leaveId: Number(result.lastInsertRowid),
      businessDays,
      replacedRequests: deletedCount
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating leave request:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la création de la demande: ' + error.message },
      { status: 500 }
    );
  }
}
