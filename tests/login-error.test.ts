import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginError } from '../src/lib/login-error';
test('sign-in failures distinguish delivery, throttling and account configuration', () => {
  assert.equal(loginError({ code: 'unexpected_failure', status: 500 }).status, 502);
  assert.match(loginError({ code: 'unexpected_failure' }).error, /SMTP/);
  assert.equal(loginError({ status: 429 }).status, 429);
  assert.equal(loginError({ code: 'over_email_send_rate_limit' }).status, 429);
  assert.match(loginError({ code: 'email_address_not_authorized' }).error, /restricted/);
  assert.match(loginError({ code: 'signup_disabled' }).error, /existing curator account/);
  assert.equal(loginError({ code: 'email_provider_disabled' }).status, 503);
});
test('unknown provider details are not exposed in the sign-in response', () => {
  const result = loginError({ code: 'sensitive-provider-detail', status: 500 });
  assert.ok(!result.error.includes('sensitive-provider-detail'));
  assert.match(result.error, /sign-in email/);
});
