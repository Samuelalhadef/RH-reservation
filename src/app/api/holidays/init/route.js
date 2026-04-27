import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

const FRENCH_HOLIDAYS = [
  { date: '2027-01-01', nom: 'Jour de l\'An', annee: 2027 },
  { date: '2027-03-29', nom: 'Lundi de Pâques', annee: 2027 },
  { date: '2027-05-01', nom: 'Fête du Travail', annee: 2027 },
  { date: '2027-05-06', nom: 'Ascension', annee: 2027 },
  { date: '2027-05-08', nom: 'Victoire 1945', annee: 2027 },
  { date: '2027-05-17', nom: 'Lundi de Pentecôte', annee: 2027 },
  { date: '2027-07-14', nom: 'Fête Nationale', annee: 2027 },
  { date: '2027-08-15', nom: 'Assomption', annee: 2027 },
  { date: '2027-11-01', nom: 'Toussaint', annee: 2027 },
  { date: '2027-11-11', nom: 'Armistice 1918', annee: 2027 },
  { date: '2027-12-25', nom: 'Noël', annee: 2027 },
];

export async function POST() {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const existingResult = await db.execute('SELECT COUNT(*) as count FROM jours_feries');

    if (existingResult.rows[0].count > 0) {
      return NextResponse.json({
        success: true,
        message: 'Les jours fériés sont déjà initialisés',
        count: existingResult.rows[0].count
      });
    }

    for (const holiday of FRENCH_HOLIDAYS) {
      await db.execute({
        sql: 'INSERT INTO jours_feries (date, nom, annee) VALUES (?, ?, ?)',
        args: [holiday.date, holiday.nom, holiday.annee]
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Jours fériés initialisés avec succès',
      count: FRENCH_HOLIDAYS.length
    });
  } catch (error) {
    console.error('Error initializing holidays:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de l\'initialisation des jours fériés' },
      { status: 500 }
    );
  }
}
