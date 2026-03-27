/**
 * close
 *
 * Kill the browser process and clean up the session.
 */

import { readSession, clearSession } from '../session.js';

export async function close(): Promise<void> {
  const session = readSession();
  if (!session) {
    console.error('No browser session to close.');
    return;
  }

  try {
    process.kill(session.pid, 'SIGTERM');
  } catch {
    // Process may already be dead
  }

  clearSession();
  console.error('Browser closed.');
}
