export function loginError(error: { code?: string; status?: number }) {
  if (
    error.status === 429 ||
    ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code || '')
  )
    return {
      status: 429,
      error: 'Too many sign-in requests. Wait before requesting another email.',
    };
  if (error.code === 'email_address_not_authorized')
    return {
      status: 403,
      error:
        'Email delivery is restricted for this address. Check the Supabase SMTP configuration.',
    };
  if (['signup_disabled', 'user_not_found', 'otp_disabled'].includes(error.code || ''))
    return {
      status: 403,
      error:
        'An existing curator account is required. Check that your user has been created in Supabase Authentication.',
    };
  if (error.code === 'email_provider_disabled')
    return {
      status: 503,
      error: 'Email sign-in is disabled in Supabase. Enable the email authentication provider.',
    };
  return {
    status: 502,
    error:
      'Supabase could not send the sign-in email. Check Authentication logs and SMTP settings, including the sender address and verified domain.',
  };
}
