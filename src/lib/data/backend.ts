import type {
  Box,
  CancelReason,
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
import type { BoardRow, GameAward, MiniGame } from "../game/types";
import type { StudioDuelState } from "../studio";

export type StudioVoteCategory = "canestro" | "assist";
/** Per ogni categoria: i voti per ogni scelta (nell'ordine delle opzioni) e la mia (null se non ho votato). */
export type StudioVoteState = Record<StudioVoteCategory, { counts: number[]; mine: number | null }>;

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
  outfit?: Partial<Record<string, string>>;
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
  | { type: "highlight_reply"; commentId: string }
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
    /** La via, solo per Indoor. */
    address?: string | null;
  }): Promise<string>;
  /** Con un motivo ("meteo") la partita resta visibile quel giorno come annullata. */
  cancelProposal(id: string, reason?: CancelReason): Promise<void>;
  respond(proposalId: string, response: ResponseKind | null): Promise<void>;
  respondFor(proposalId: string, playerId: string, response: ResponseKind | null): Promise<void>;
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
  createExtra(name: string): Promise<string>;
  listPrivate(): Promise<PlayerPrivate[]>;
  setLinkEmail(playerId: string, email: string | null): Promise<void>;
  regenerateInvite(playerId: string): Promise<string>;
  unlinkPlayer(playerId: string): Promise<void>;
  listPending(): Promise<PendingUser[]>;
  resolvePending(userId: string, playerId: string | null): Promise<void>;

  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>;
  removePushSubscription(endpoint: string): Promise<void>;
  /** Il server ha ancora questa iscrizione, a nome mio? (Se è scaduta l'ha cancellata.) */
  hasPushSubscription(endpoint: string): Promise<boolean>;
  notify(body: NotifyBody): Promise<void>;
  sendFeedback(input: FeedbackInput): Promise<void>;
  /** "Sono passato di qui": serve al promemoria settimanale per chi non apre l'app da giorni. */
  touchSeen(): Promise<void>;

  /** Il voto dello Studio (canestro e assist della giornata): com'è messo e cosa ho votato io. */
  studioVoteState(episode: string, options: number): Promise<StudioVoteState>;
  /** Il mio voto: uno per categoria, definitivo. Se c'era già, torna lo stato com'è (senza cambiarlo). */
  studioVote(episode: string, category: StudioVoteCategory, choice: number, options: number): Promise<StudioVoteState>;
  /** Il voto a sfide dello Studio: le mie scelte, i conteggi per coppia, l'ultima scelta di ognuno. */
  studioDuelState(episode: string): Promise<StudioDuelState>;
  /** La mia scelta in una sfida (a = la preferita di prima, b = l'azione appena vista): una sola, definitiva. */
  studioDuel(episode: string, category: StudioVoteCategory, round: number, a: number, b: number, choice: number): Promise<StudioDuelState>;

  /** Like e commenti degli highlights indicati (si chiedono solo quando si apre il feed). */
  loadHighlightSocial(highlightIds: string[]): Promise<HighlightSocial>;
  /** Mi piace (il pallone): true lo mette, false lo toglie. Ripeterlo non fa danni. */
  setHighlightLike(highlightId: string, on: boolean): Promise<void>;
  /** replyTo: il commento a cui si risponde; chi l'ha scritto riceve una notifica. */
  addHighlightComment(
    highlightId: string,
    body: string,
    replyTo?: string | null,
  ): Promise<HighlightComment>;
  deleteHighlightComment(commentId: string): Promise<void>;
  /** Like e commenti degli altri in diretta, finché il feed è aperto. */
  subscribeHighlights(onChange: () => void): () => void;

  // Campetto Star
  /** Il mio salvataggio (null se non ho mai giocato). */
  loadGame(): Promise<{ state: unknown; updatedAt: string } | null>;
  saveGame(state: unknown): Promise<void>;
  /** Le tre classifiche (il record di sempre di ognuno) e i re delle ultime notti. */
  loadGameBoards(): Promise<{ rows: BoardRow[]; kings: GameKing[] }>;
  /** Manda un punteggio: torna il mio record (resta il più alto). */
  submitGameScore(game: MiniGame, score: number): Promise<number>;
  /** I premi di mezzanotte vinti e non ancora ritirati (una volta sola). */
  claimGameAwards(): Promise<GameAward[]>;
}

export interface GameKing {
  day: string;
  game: MiniGame;
  playerId: string;
  score: number;
}

export type { Player };
