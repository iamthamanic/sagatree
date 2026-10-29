/**
 * client-trust-body_test — unit tests for privileged Edge body keys (#675).
 * Location: supabase/functions/_shared/client-trust-body_test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  findPrivilegedClientBodyKeys,
  privilegedClientBodyRejectionMessage,
} from './client-trust-body.ts';

Deno.test('findPrivilegedClientBodyKeys detects ownership and counters', () => {
  assertEquals(
    findPrivilegedClientBodyKeys({
      sessionId: 'ok',
      author_id: 'attacker',
      rating: 5,
      downloads: 9999,
    }),
    ['author_id', 'rating', 'downloads'],
  );
});

Deno.test('findPrivilegedClientBodyKeys ignores allowlisted fields', () => {
  assertEquals(
    findPrivilegedClientBodyKeys({
      action: 'save',
      sessionId: 'abc',
      definitionId: 'def',
    }),
    [],
  );
});

Deno.test('privilegedClientBodyRejectionMessage fails closed', () => {
  assertEquals(
    privilegedClientBodyRejectionMessage({ roles: ['admin'] }),
    'Client darf privilegierte Felder nicht setzen: roles',
  );
  assertEquals(privilegedClientBodyRejectionMessage({ action: 'list' }), null);
});
