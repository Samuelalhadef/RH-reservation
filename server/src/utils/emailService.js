import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envoie un email de notification pour une demande de congés validée
 */
export const sendLeaveApprovedEmail = async (userEmail, userName, startDate, endDate, days) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'RH Chartrettes <onboarding@resend.dev>',
      to: [userEmail],
      subject: 'Demande de congés validée',
      html: `
        <h2>Demande de congés validée ✅</h2>
        <p>Bonjour ${userName},</p>
        <p>Votre demande de congés a été <strong>validée</strong> par le service RH.</p>
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Période :</strong> du ${startDate} au ${endDate}</p>
          <p><strong>Nombre de jours :</strong> ${days} jour(s) ouvré(s)</p>
        </div>
        <p>Bonnes vacances !</p>
        <p>L'équipe RH - Mairie de Chartrettes</p>
      `,
    });

    if (error) {
      console.error('Error sending approval email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending approval email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoie un email de notification pour une demande de congés refusée
 */
export const sendLeaveRejectedEmail = async (userEmail, userName, startDate, endDate, reason) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'RH Chartrettes <onboarding@resend.dev>',
      to: [userEmail],
      subject: 'Demande de congés refusée',
      html: `
        <h2>Demande de congés refusée ❌</h2>
        <p>Bonjour ${userName},</p>
        <p>Votre demande de congés a été <strong>refusée</strong> par le service RH.</p>
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Période demandée :</strong> du ${startDate} au ${endDate}</p>
          ${reason ? `<p><strong>Motif du refus :</strong> ${reason}</p>` : ''}
        </div>
        <p>Pour plus d'informations, veuillez contacter le service RH.</p>
        <p>L'équipe RH - Mairie de Chartrettes</p>
      `,
    });

    if (error) {
      console.error('Error sending rejection email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoie un email de notification à la RH pour une nouvelle demande
 */
export const sendNewLeaveRequestEmail = async (rhEmail, userName, startDate, endDate, days) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'RH Chartrettes <onboarding@resend.dev>',
      to: [rhEmail],
      subject: 'Nouvelle demande de congés à valider',
      html: `
        <h2>Nouvelle demande de congés 📋</h2>
        <p>Une nouvelle demande de congés est en attente de validation.</p>
        <div style="background-color: #fffbeb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Employé :</strong> ${userName}</p>
          <p><strong>Période :</strong> du ${startDate} au ${endDate}</p>
          <p><strong>Nombre de jours :</strong> ${days} jour(s) ouvré(s)</p>
        </div>
        <p>Connectez-vous à l'application pour valider ou refuser cette demande.</p>
        <p>Système de gestion RH - Mairie de Chartrettes</p>
      `,
    });

    if (error) {
      console.error('Error sending new request email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending new request email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoie un email avec un mot de passe temporaire
 */
export const sendTemporaryPasswordEmail = async (userEmail, userName, tempPassword) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'RH Chartrettes <onboarding@resend.dev>',
      to: [userEmail],
      subject: 'Votre mot de passe temporaire',
      html: `
        <h2>Bienvenue sur l'application de gestion des congés 🔑</h2>
        <p>Bonjour ${userName},</p>
        <p>Votre compte a été créé. Voici vos informations de connexion :</p>
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email :</strong> ${userEmail}</p>
          <p><strong>Mot de passe temporaire :</strong> <code style="background-color: #dbeafe; padding: 5px 10px; border-radius: 3px;">${tempPassword}</code></p>
        </div>
        <p><strong>⚠️ Important :</strong> Vous devrez changer ce mot de passe lors de votre première connexion.</p>
        <p>L'équipe RH - Mairie de Chartrettes</p>
      `,
    });

    if (error) {
      console.error('Error sending temporary password email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending temporary password email:', error);
    return { success: false, error: error.message };
  }
};
