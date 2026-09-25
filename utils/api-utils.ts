import { ENV } from '../config/environments';

/**
 * Triggers the password-reset email via the Remitbee Core API.
 * Used in forgot-password flow tests.
 */
export async function triggerPasswordResetLink(email: string = ENV.FORGET_PASSWORD_EMAIL): Promise<void> {
  const response = await fetch(`${ENV.CORE_API}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`triggerPasswordResetLink failed (${response.status}): ${body}`);
  }
}
