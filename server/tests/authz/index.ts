/**
 * Host authz test barrel (MIG-600).
 * Location: server/tests/authz/index.ts
 */
export {
  runHostNegativeAuthzSuite,
  seedAuthzFixture,
  type AuthzActorKind,
  type AuthzCaseResult,
  type HostNegativeAuthzReport,
} from './host-negative-authz-suite.ts';
