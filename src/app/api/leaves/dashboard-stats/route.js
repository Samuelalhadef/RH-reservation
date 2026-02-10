import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

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
    const year = searchParams.get('year') || new Date().getFullYear();
    const currentYear = year.toString();

    // Exécuter toutes les requêtes en parallèle
    const [
      statsResult,
      monthlyResult,
      userTypeResult,
      topUsersResult,
      balancesResult,
      balanceDistributionResult,
      approvalRateResult,
      quarterlyResult,
      avgDurationResult,
      avgValidationTimeResult,
      weekdayResult,
      utilizationResult
    ] = await Promise.all([
      // Statistiques globales des demandes
      db.execute({
        sql: `
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN statut = 'en_attente' THEN 1 ELSE 0 END) as en_attente,
            SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) as validee,
            SUM(CASE WHEN statut = 'refusee' THEN 1 ELSE 0 END) as refusee,
            SUM(CASE WHEN statut = 'validee' THEN nombre_jours_ouvres ELSE 0 END) as total_jours_valides
          FROM demandes_conges
          WHERE strftime('%Y', date_debut) = ?
        `,
        args: [currentYear]
      }),

      // Demandes par mois
      db.execute({
        sql: `
          SELECT
            strftime('%m', date_debut) as mois,
            COUNT(*) as total,
            SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) as validees,
            SUM(CASE WHEN statut = 'refusee' THEN 1 ELSE 0 END) as refusees,
            SUM(CASE WHEN statut = 'en_attente' THEN 1 ELSE 0 END) as en_attente
          FROM demandes_conges
          WHERE strftime('%Y', date_debut) = ?
          GROUP BY strftime('%m', date_debut)
          ORDER BY mois
        `,
        args: [currentYear]
      }),

      // Demandes par type d'utilisateur
      db.execute({
        sql: `
          SELECT
            u.type_utilisateur,
            COUNT(*) as total_demandes,
            SUM(CASE WHEN dc.statut = 'validee' THEN 1 ELSE 0 END) as validees,
            SUM(CASE WHEN dc.statut = 'validee' THEN dc.nombre_jours_ouvres ELSE 0 END) as jours_pris
          FROM demandes_conges dc
          JOIN users u ON dc.user_id = u.id
          WHERE strftime('%Y', dc.date_debut) = ?
          GROUP BY u.type_utilisateur
        `,
        args: [currentYear]
      }),

      // Top 10 des employés avec le plus de congés pris
      db.execute({
        sql: `
          SELECT
            u.nom,
            u.prenom,
            u.type_utilisateur,
            COUNT(*) as nombre_demandes,
            SUM(CASE WHEN dc.statut = 'validee' THEN dc.nombre_jours_ouvres ELSE 0 END) as jours_pris,
            sc.jours_restants
          FROM demandes_conges dc
          JOIN users u ON dc.user_id = u.id
          LEFT JOIN soldes_conges sc ON u.id = sc.user_id AND sc.annee = ?
          WHERE strftime('%Y', dc.date_debut) = ?
          GROUP BY u.id
          ORDER BY jours_pris DESC
          LIMIT 10
        `,
        args: [currentYear, currentYear]
      }),

      // Statistiques des soldes
      db.execute({
        sql: `
          SELECT
            COUNT(*) as total_users,
            SUM(jours_acquis) as total_acquis,
            SUM(jours_pris) as total_pris,
            SUM(jours_restants) as total_restants,
            AVG(jours_restants) as moyenne_restants
          FROM soldes_conges
          WHERE annee = ?
        `,
        args: [currentYear]
      }),

      // Distribution des soldes restants
      db.execute({
        sql: `
          SELECT
            CASE
              WHEN jours_restants = 0 THEN '0 jours'
              WHEN jours_restants BETWEEN 1 AND 5 THEN '1-5 jours'
              WHEN jours_restants BETWEEN 6 AND 10 THEN '6-10 jours'
              WHEN jours_restants BETWEEN 11 AND 15 THEN '11-15 jours'
              WHEN jours_restants BETWEEN 16 AND 20 THEN '16-20 jours'
              ELSE '21+ jours'
            END as tranche,
            COUNT(*) as nombre_employes
          FROM soldes_conges sc
          JOIN users u ON sc.user_id = u.id
          WHERE sc.annee = ? AND u.actif = 1
          GROUP BY tranche
          ORDER BY
            CASE tranche
              WHEN '0 jours' THEN 1
              WHEN '1-5 jours' THEN 2
              WHEN '6-10 jours' THEN 3
              WHEN '11-15 jours' THEN 4
              WHEN '16-20 jours' THEN 5
              ELSE 6
            END
        `,
        args: [currentYear]
      }),

      // Taux d'approbation par mois
      db.execute({
        sql: `
          SELECT
            strftime('%m', date_validation) as mois,
            COUNT(*) as total_traitees,
            SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) as validees,
            ROUND(CAST(SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as taux_approbation
          FROM demandes_conges
          WHERE strftime('%Y', date_validation) = ? AND statut != 'en_attente'
          GROUP BY strftime('%m', date_validation)
          ORDER BY mois
        `,
        args: [currentYear]
      }),

      // Statistiques par trimestre
      db.execute({
        sql: `
          SELECT
            CASE
              WHEN CAST(strftime('%m', date_debut) AS INTEGER) BETWEEN 1 AND 3 THEN 'T1'
              WHEN CAST(strftime('%m', date_debut) AS INTEGER) BETWEEN 4 AND 6 THEN 'T2'
              WHEN CAST(strftime('%m', date_debut) AS INTEGER) BETWEEN 7 AND 9 THEN 'T3'
              ELSE 'T4'
            END as trimestre,
            COUNT(*) as total_demandes,
            SUM(CASE WHEN statut = 'validee' THEN nombre_jours_ouvres ELSE 0 END) as jours_valides
          FROM demandes_conges
          WHERE strftime('%Y', date_debut) = ?
          GROUP BY trimestre
          ORDER BY
            CASE trimestre
              WHEN 'T1' THEN 1
              WHEN 'T2' THEN 2
              WHEN 'T3' THEN 3
              ELSE 4
            END
        `,
        args: [currentYear]
      }),

      // Durée moyenne des congés par type d'utilisateur
      db.execute({
        sql: `
          SELECT
            u.type_utilisateur,
            ROUND(AVG(dc.nombre_jours_ouvres), 2) as duree_moyenne,
            COUNT(*) as nombre_demandes
          FROM demandes_conges dc
          JOIN users u ON dc.user_id = u.id
          WHERE strftime('%Y', dc.date_debut) = ? AND dc.statut = 'validee'
          GROUP BY u.type_utilisateur
        `,
        args: [currentYear]
      }),

      // Délai moyen de validation (en jours)
      db.execute({
        sql: `
          SELECT
            ROUND(AVG(julianday(date_validation) - julianday(date_demande)), 1) as delai_moyen_jours
          FROM demandes_conges
          WHERE strftime('%Y', date_debut) = ? AND statut != 'en_attente' AND date_validation IS NOT NULL
        `,
        args: [currentYear]
      }),

      // Congés par jour de la semaine (début de congé)
      db.execute({
        sql: `
          SELECT
            CASE CAST(strftime('%w', date_debut) AS INTEGER)
              WHEN 0 THEN 'Dimanche'
              WHEN 1 THEN 'Lundi'
              WHEN 2 THEN 'Mardi'
              WHEN 3 THEN 'Mercredi'
              WHEN 4 THEN 'Jeudi'
              WHEN 5 THEN 'Vendredi'
              WHEN 6 THEN 'Samedi'
            END as jour_semaine,
            COUNT(*) as nombre_demandes
          FROM demandes_conges
          WHERE strftime('%Y', date_debut) = ? AND statut = 'validee'
          GROUP BY CAST(strftime('%w', date_debut) AS INTEGER)
          ORDER BY CAST(strftime('%w', date_debut) AS INTEGER)
        `,
        args: [currentYear]
      }),

      // Taux d'utilisation des congés par utilisateur
      db.execute({
        sql: `
          SELECT
            u.type_utilisateur,
            ROUND(AVG(CAST(sc.jours_pris AS FLOAT) / sc.jours_acquis * 100), 1) as taux_utilisation
          FROM soldes_conges sc
          JOIN users u ON sc.user_id = u.id
          WHERE sc.annee = ? AND sc.jours_acquis > 0 AND u.actif = 1
          GROUP BY u.type_utilisateur
        `,
        args: [currentYear]
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        global: statsResult.rows[0],
        monthly: monthlyResult.rows,
        byUserType: userTypeResult.rows,
        topUsers: topUsersResult.rows,
        balances: balancesResult.rows[0],
        balanceDistribution: balanceDistributionResult.rows,
        approvalRate: approvalRateResult.rows,
        quarterly: quarterlyResult.rows,
        avgDuration: avgDurationResult.rows,
        avgValidationTime: avgValidationTimeResult.rows[0],
        weekday: weekdayResult.rows,
        utilization: utilizationResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    );
  }
}
