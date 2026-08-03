import seedrandom from "seedrandom";

export type RandomSource = () => number;

export function createSeededRandom(seed: string): RandomSource {
  return seedrandom(seed);
}

export function createRandomSeed(random: RandomSource): string {
  const segment = () => Math.floor(random() * 0x1_0000_0000).toString(36).padStart(7, "0");
  return `forge-${segment()}-${segment()}`;
}

export function shuffleWith<T>(cards: readonly T[], random: RandomSource): T[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
