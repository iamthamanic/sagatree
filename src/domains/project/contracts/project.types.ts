/**
 * Project Types
 * A project is a campaign/adventure with a GM and players
 */

// ============================================
// DTOs (Data Transfer Objects - persisted rows)
// ============================================

export interface ProjectDto {
  id: string;
  /** Immutable public saga id (SA-XXXXX). Never a permission secret. Empty until migration backfill. */
  public_id?: string;
  code: string;
  name: string;
  description: string | null;
  world_id: string | null;
  /** SagaTree world profile binding (inventory/NPC catalogs). */
  world_profile_id?: string | null;
  /** Optional saga default LookProfile id (#348). */
  default_look_profile_id?: string | null;
  /** When true, personal character Look overrides may apply (#348). */
  allow_player_character_look_override?: boolean;
  gm_user_id: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberDto {
  id: string;
  project_id: string;
  user_id: string;
  character_id: string | null;
  role: 'gm' | 'player';
  joined_at: string;
  status: 'active' | 'inactive' | 'kicked';
}

export type ProjectSessionStatus =
  | 'scheduled'
  | 'waiting'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface SessionDto {
  id: string;
  /** Immutable public session id (SE-XXXXX). Empty until migration backfill. */
  public_id?: string;
  project_id: string;
  /** Immutable order within a saga — not the resource identity. */
  session_number: number;
  name: string | null;
  notes: string | null;
  status: ProjectSessionStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  /** Optional session Look override (#349). Null/omitted → inherit saga default. */
  look_profile_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// View Models (for UI consumption)
// ============================================

export interface ProjectMemberVm {
  id: string;
  userId: string;
  characterId: string | null;
  role: 'gm' | 'player';
  joinedAt: string;
  status: 'active' | 'inactive' | 'kicked';
}

export interface SessionVm {
  id: string;
  publicId: string;
  projectId: string;
  sessionNumber: number;
  name: string | null;
  notes: string | null;
  status: ProjectSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  /** Optional session Look override (#349). Null → inherit saga. */
  lookProfileId: string | null;
  createdAt: string;
}

export interface ProjectVm {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description: string | null;
  worldId: string | null;
  worldProfileId: string | null;
  /** Optional saga default LookProfile (#348). Null → system default. */
  defaultLookProfileId: string | null;
  /** GM: allow player personal character Look overrides (#348). */
  allowPlayerCharacterLookOverride: boolean;
  gmUserId: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  members: ProjectMemberVm[];
  sessions: SessionVm[];
  totalSessions: number;
  lastSessionDate: string | null;
}

/** Slim list row for Bibliothek/Dashboard — no per-project member/session arrays. */
export interface ProjectSummaryVm {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description: string | null;
  /** Optional world binding for lore/context pickers — no members/sessions arrays. */
  worldId: string | null;
  /** Optional world-profile binding hint for fixture/prepare UIs. */
  worldProfileId: string | null;
  /** Story definition pin (#574). */
  sagaId: string | null;
  sagaVersionId: string | null;
  sagaTitle: string | null;
  /** saga_definitions.slug when joined (native covers, deep links). */
  sagaSlug: string | null;
  sagaOrigin: 'native' | 'user' | 'private_backfill' | null;
  gmUserId: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  memberCount: number;
  sessionCount: number;
}

// ============================================
// Create DTOs (for creating new records)
// ============================================

export interface CreateProjectDto {
  name: string;
  description?: string;
  world_id?: string;
  /** Bind adventure to an editable world profile (optional). */
  world_profile_id?: string;
}

export interface JoinProjectDto {
  code: string;
  character_id?: string;
}

export interface CreateSessionDto {
  project_id: string;
  /** Optional; when omitted, DB allocates next number concurrency-safe. */
  session_number?: number;
  name?: string;
  notes?: string;
}

export interface UpdateSessionDto {
  id: string;
  name?: string;
  notes?: string;
  status?: ProjectSessionStatus;
  started_at?: string;
  ended_at?: string;
}