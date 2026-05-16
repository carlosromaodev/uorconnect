type PassportMissionDisplaySnapshot = {
  key: string;
  points?: number | null;
  pointsEarned?: number | null;
  completions?: number | null;
  status?: string | null;
};

type PassportSummaryDisplaySnapshot = {
  points?: number | null;
  missions?: PassportMissionDisplaySnapshot[] | null;
};

export function getPassportJoinAwardedPoints(
  summary?: PassportSummaryDisplaySnapshot | null,
) {
  const mission = summary?.missions?.find(
    (item) => item.key === "accept-challenge",
  );
  if (!mission) return 0;

  const points = Math.max(0, mission.points ?? 0);
  const earned = Math.max(0, mission.pointsEarned ?? 0);
  const completed =
    mission.status === "done" || (mission.completions ?? 0) > 0 || earned > 0;

  return completed ? Math.max(points, earned) : 0;
}

export function getPassportDisplayPoints(
  summary?: PassportSummaryDisplaySnapshot | null,
  fallbackPoints = 0,
) {
  const basePoints =
    typeof summary?.points === "number" ? summary.points : fallbackPoints;

  return Math.max(basePoints, getPassportJoinAwardedPoints(summary));
}

export function shouldShowPassportCelebrationPoints(points: number) {
  return points !== 0;
}
