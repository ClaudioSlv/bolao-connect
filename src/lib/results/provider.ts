import type { LotteryId } from "../domain";
import type { DrawResult } from "../lotteries/checker";

export interface LotteryResultProvider {
  getContest(lottery: LotteryId, contestNumber: number): Promise<DrawResult>;
  getLatest(lottery: LotteryId): Promise<DrawResult>;
}

// O restante do app depende desta interface, e não de uma URL externa específica.
// Assim podemos trocar a fonte de resultados sem reescrever a conferência dos jogos.
