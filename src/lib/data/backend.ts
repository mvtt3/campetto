import type {
  Box,
  Dataset,
  EventKind,
  Format,
  HighlightComment,
  HighlightSocial,
  NotifyPrefs,
  Player,
  Place,
  ResponseKind,
  StatsSource,
  Team,
} from "../types";

export interface SaveMatchInput {
  id?: string;
  playedAt: string;
  format: Format;
  targetPoints: number;
  scoreA: number;
  scoreB: number;
  statsSource: StatsSource;
  notes?: string | null;
  players: {
    playerId: string;
    team: Team;
    hasStats: boolean;
    box: Box;
    sub?: boolean;
  }[];
  events: {
    playerId: string;
    kind: EventKind;
    targetPlayerId: string | null;
    videoTs: number | null;
  }[];
}

export interface MePatch {
  nickname?: string | null;
  jerseyNumber?: number | null;
  cardColor?: string | null;
  avatarUrl?: string | null;
  character?: string | null;
  showcase?: string[];
  notifyPrefs?: NotifyPrefs;
}

export interface FeedbackInput {
  kind: "problema" | "idea" | "altro";
  message: string;
  screen: string | null;
  device: string | null;
  appVersion: string | null;
}

export interface PlayerInput {
  id?: string;
  firstName: string;
  lastName: string | null;
  roles: string[];
  archived?: boolean;
  isAdmin?: boolean;
}

export interface PlayerPrivate {
  playerId: string;
  inviteToken: string;
  linkEmail: string | null;
}

export interface PendingUser {
  userId: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export type NotifyBody =
  | { type: "proposal_new"; proposalId: string }
  | { type: "proposal_response"; proposalId: string }
  | { type: "proposal_cancelled"; proposalId: string }
  | { type: "proposal_alternative"; proposalId: string }
  | { type: "proposal_moved"; proposalId: string }
  | { type: "feedback"; kind: string }
  | { type: "match_saved"; matchId: string; isNew: boolean }
  | { type: "flush" }
  | { type: "test" };

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "pending"; email: string | null }
  | { status: "error"; message: string }
  | { status: "ready"; meId: string };

export interface Backend {
  readonly kind: "supabase" | "mock";
  /** Resolves the session, links the account (invite or email) and returns the auth state. */
  init(inviteToken?: string | null): Promise<AuthState>;
  onAuthChange(cb: () => void): () => void;
  loadAll(): Promise<Dataset>;
  subscribe(onChange: () => void): () => void;
  signIn(next?: string): Promise<void>;
  signOut(): Promise<void>;

  saveMatch(input: SaveMatchInput): Promise<string>;
  deleteMatch(id: string): Promise<void>;
  confirmMatch(id: string): Promise<void>;

  createProposal(input: {
    startsAt: string;
    format: Format | null;
    note: string | null;
    place: Place | null;
  }): Promise<string>;
  cancelProposal(id: string): Promise<void>;
  respond(proposalId: string, response: ResponseKind | null): Promise<void>;
  /** La mia controproposta (stesso giorno): null la toglie. */
  setAlternative(
    proposalId: string,
    alt: { startsAt: string | null; place: Place | null } | null,
  ): Promise<void>;
  /** Sposta la partita su un altro orario e/o campetto, stesso giorno. */
  moveProposal(
    proposalId: string,
    startsAt: string,
    place: Place | null,
  ): Promise<void>;

  updateMe(patch: MePatch): Promise<void>;
  uploadAvatar(file: Blob): Promise<string>;

  upsertPlayer(input: PlayerInput): Promise<string>;
  /** Un ospite per una partita: fuori dal gruppo e dalle statistiche. */
  createGuest(name: string): Promise<string>;
  listPrivate(): Promise<PlayerPrivate[]>;
  setLinkEmail(playerId: string, email: string | null): Promise<void>;
  regenerateInvite(playerId: string): Promise<string>;
  unlinkPlayer(playerId: string): Promise<void>;
  listPending(): Promise<PendingUser[]>;
  resolvePending(userId: string, playerId: string | null): Promise<void>;

  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>;
  removePushSubscription(endpoint: string): Promise<void>;
  notify(body: NotifyBody): Promise<void>;
  sendFeedback(input: FeedbackInput): Promise<void>;
  /** "Sono passato di qui": serve al promemoria settimanale per chi non apre l'app da giorni. */
  touchSeen(): Promise<void>;

  /** Like e commenti degli highlights indicati (si chiedono solo quando si apre il feed). */
  loadHighlightSocial(highlightIds: string[]): Promise<HighlightSocial>;
  /** Mi piace (il pallone): true lo mette, false lo toglie. Ripeterlo non fa danni. */
  setHighlightLike(highlightId: string, on: boolean): Promise<void>;
  addHighlightComment(
    highlightId: string,
    body: string,
  ): Promise<HighlightComment>;
  deleteHighlightComment(commentId: string): Promise<void>;
  /** Like e commenti degli altri in diretta, finché il feed è aperto. */
  subscribeHighlights(onChange: () => void): () => void;
}

export type { Player };
