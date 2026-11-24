export const sentEmails = (globalThis.__sentEmails ||= []);
const rec = (kind) => async (...args) => { sentEmails.push({ kind, args }); return { success: true }; };
export const sendLeaveApprovedEmail = rec('approved');
export const sendLeaveRejectedEmail = rec('rejected');
export const sendNewLeaveRequestEmail = rec('new');
export const sendTemporaryPasswordEmail = rec('temp-password');
