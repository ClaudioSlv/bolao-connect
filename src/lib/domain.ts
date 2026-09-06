export type PoolStatus = "draft" | "open" | "payment_closed" | "drawn" | "archived";
export type ParticipantStatus = "invited" | "confirmed" | "waitlist" | "cancelled";
export type PaymentStatus = "pending" | "partial" | "confirmed" | "cancelled";
export type LotteryId =
  | "mega-sena"
  | "lotofacil"
  | "quina"
  | "dupla-sena"
  | "lotomania"
  | "timemania"
  | "dia-de-sorte"
  | "super-sete"
  | "mais-milionaria";

export interface Pool {
  id: string;
  ownerId: string;
  title: string;
  lottery: LotteryId;
  contestNumber?: number;
  estimatedPrizeCents?: number;
  sharePriceCents: number;
  totalShares: number;
  paymentDeadline: string;
  drawAt?: string;
  status: PoolStatus;
  publicSlug: string;
}

export interface Participant {
  id: string;
  poolId: string;
  userId?: string;
  name: string;
  phone?: string;
  telegramUsername?: string;
  shares: number;
  status: ParticipantStatus;
  paymentStatus: PaymentStatus;
}

export interface WalletSummary {
  targetCents: number;
  confirmedCents: number;
  pendingCents: number;
  confirmedShares: number;
  pendingShares: number;
}
