#!/usr/bin/env node
/**
 * Self-test for Local Admin JWT adopt/discard policy (#login-race harden).
 * Location: scripts/local-admin-auth-policy.self-test.mjs
 *
 * Mirrors src/lib/localAdminAuthPolicy.ts — keep in sync.
 */
import process from 'node:process';

function assert(condition, message) {
  if (!condition) {
    console.error(`local-admin-auth-policy self-test failed: ${message}`);
    process.exit(1);
  }
}

function decideLocalAdminJwt(ctx) {
  if (!ctx.sessionUserIsSeededAdmin) return 'ignore';
  if (ctx.currentUserIsOther) return 'discard';
  if (ctx.localAdminSessionActive) return 'adopt';
  return 'discard';
}

function mayDiscardLocalAdminJwt(localAdminSessionActive) {
  return !localAdminSessionActive;
}

// HMR / Strict remount race: flag set, no UI user yet, JWT arrives → adopt
assert(
  decideLocalAdminJwt({
    localAdminSessionActive: true,
    sessionUserIsSeededAdmin: true,
    currentUserIsOther: false,
  }) === 'adopt',
  'active Local Admin + admin JWT must adopt (remount race)',
);

// Happy path already logged in as admin
assert(
  decideLocalAdminJwt({
    localAdminSessionActive: true,
    sessionUserIsSeededAdmin: true,
    currentUserIsOther: false,
  }) === 'adopt',
  'active Local Admin keeps JWT',
);

// Anti-resurrection after logout (flag cleared)
assert(
  decideLocalAdminJwt({
    localAdminSessionActive: false,
    sessionUserIsSeededAdmin: true,
    currentUserIsOther: false,
  }) === 'discard',
  'logged-out late admin JWT must discard',
);

// Different user wins
assert(
  decideLocalAdminJwt({
    localAdminSessionActive: true,
    sessionUserIsSeededAdmin: true,
    currentUserIsOther: true,
  }) === 'discard',
  'other user must not be overwritten by admin JWT',
);

// Non-admin session ignored by this policy
assert(
  decideLocalAdminJwt({
    localAdminSessionActive: false,
    sessionUserIsSeededAdmin: false,
    currentUserIsOther: false,
  }) === 'ignore',
  'non-admin JWT is ignore',
);

assert(mayDiscardLocalAdminJwt(true) === false, 'must not discard while Local Admin wanted');
assert(mayDiscardLocalAdminJwt(false) === true, 'may discard after logout');

console.log('local-admin-auth-policy self-test: PASS');
