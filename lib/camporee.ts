export type CamporeeScoreEntry = {
  category: string;
  score: number;
  registrationId: string;
  clubName: string;
  clubCode: string;
};

export type CamporeeCategoryStanding = {
  category: string;
  entries: Array<CamporeeScoreEntry & { rank: number }>;
};

export type CamporeeTotalStanding = {
  registrationId: string;
  clubName: string;
  clubCode: string;
  totalScore: number;
  scoredCategories: string[];
  rank: number;
};

function normalizeCategory(value: string) {
  return value.trim();
}

function compareEntryScore(a: { score: number; clubName: string }, b: { score: number; clubName: string }) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  return a.clubName.localeCompare(b.clubName);
}

export function buildCamporeeCategoryStandings(scores: CamporeeScoreEntry[]): CamporeeCategoryStanding[] {
  const byCategory = new Map<string, CamporeeScoreEntry[]>();

  for (const score of scores) {
    const category = normalizeCategory(score.category);
    const existing = byCategory.get(category) ?? [];
    existing.push({
      ...score,
      category,
    });
    byCategory.set(category, existing);
  }

  return Array.from(byCategory.entries())
    .map(([category, entries]) => ({
      category,
      entries: [...entries]
        .sort(compareEntryScore)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        })),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function buildCamporeeTotalStandings(scores: CamporeeScoreEntry[]): CamporeeTotalStanding[] {
  const totals = new Map<
    string,
    {
      registrationId: string;
      clubName: string;
      clubCode: string;
      totalScore: number;
      scoredCategories: Set<string>;
    }
  >();

  for (const score of scores) {
    const existing = totals.get(score.registrationId) ?? {
      registrationId: score.registrationId,
      clubName: score.clubName,
      clubCode: score.clubCode,
      totalScore: 0,
      scoredCategories: new Set<string>(),
    };

    existing.totalScore += score.score;
    existing.scoredCategories.add(normalizeCategory(score.category));
    totals.set(score.registrationId, existing);
  }

  return Array.from(totals.values())
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }

      return a.clubName.localeCompare(b.clubName);
    })
    .map((entry, index) => ({
      registrationId: entry.registrationId,
      clubName: entry.clubName,
      clubCode: entry.clubCode,
      totalScore: entry.totalScore,
      scoredCategories: Array.from(entry.scoredCategories).sort((a, b) => a.localeCompare(b)),
      rank: index + 1,
    }));
}
