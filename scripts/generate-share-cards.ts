import path from 'path';
import { generateShareCardFile, type Edition, type UserStats } from '../lib/share-card-generator';

async function main() {
  const outDir = path.join(process.cwd(), 'share-card-test-output');

  const sample: UserStats = {
    username: 'Test User',
    avatarUrl: undefined,
    totalProfit: 12847,
    returnPercent: 247,
    winRate: 94,
    totalTrades: 158,
    bestTrade: 1142,
    profitFactor: 4.8,
  };

  const editions: Edition[] = ['black', 'ruby', 'emerald', 'sapphire', 'diamond'];

  for (const edition of editions) {
    const outPath = path.join(outDir, `sample-${edition}.png`);
    await generateShareCardFile({ edition, stats: sample }, outPath);
    // eslint-disable-next-line no-console
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
