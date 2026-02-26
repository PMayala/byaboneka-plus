// ============================================
// MATCH NOTIFICATION TRIGGER
// File: src/services/matchNotificationTrigger.ts
// Gap: sendMatchNotificationEmail() exists but is never called
//
// This connects the matching engine to email notifications.
// ============================================

import { query } from '../config/database';
import { sendMatchNotificationEmail } from './emailService';

/**
 * After matches are computed for a lost item, notify the owner
 * if high-confidence matches are found (score >= 10).
 * 
 * Call this at the end of findMatchesForLostItem() in matchingService.ts
 */
export async function notifyOwnerOfMatches(
  lostItemId: number,
  matches: Array<{ found_item_id: number; score: number }>
): Promise<void> {
  // Only notify for high-confidence matches
  const strongMatches = matches.filter(m => m.score >= 10);
  if (strongMatches.length === 0) return;

  try {
    // Get lost item owner info
    const lostResult = await query(
      `SELECT li.title, u.email, u.name, np.email_matches 
       FROM lost_items li 
       JOIN users u ON li.user_id = u.id
       LEFT JOIN notification_preferences np ON np.user_id = u.id
       WHERE li.id = $1`,
      [lostItemId]
    );

    if (lostResult.rows.length === 0) return;
    const { email, name, title: lostTitle, email_matches } = lostResult.rows[0];

    // Respect notification preferences
    if (email_matches === false) return;

    // Get the best match details
    const bestMatch = strongMatches[0];
    const foundResult = await query(
      'SELECT title FROM found_items WHERE id = $1',
      [bestMatch.found_item_id]
    );

    if (foundResult.rows.length === 0) return;
    const foundTitle = foundResult.rows[0].title;

    // Send the notification (async, don't block)
    const matchPercent = Math.min(Math.round((bestMatch.score / 16) * 100), 99);
    await sendMatchNotificationEmail(
      email,
      name,
      lostTitle,
      foundTitle,
      matchPercent,
      lostItemId
    );

    console.log(`📧 Match notification sent to ${email} for lost item #${lostItemId}`);
  } catch (error) {
    // Don't let notification errors crash matching
    console.error('Match notification error:', error);
  }
}


// ============================================
// INTEGRATION:
// In src/services/matchingService.ts, at the end of findMatchesForLostItem():
//
// import { notifyOwnerOfMatches } from './matchNotificationTrigger';
//
// // After computing and storing matches:
// if (matches.length > 0) {
//   notifyOwnerOfMatches(lostItemId, matches).catch(err =>
//     console.error('Match notification failed:', err)
//   );
// }
// ============================================
