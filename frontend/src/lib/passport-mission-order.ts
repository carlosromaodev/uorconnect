type PassportMissionOrderItem = {
  key: string;
};

const PASSPORT_MISSION_PRIORITY: Record<string, number> = {
  "accept-challenge": 0,
  "affiliate-invite": 1,
  "event-checkin": 2,
  "workshop-checkin": 3,
  "workshop-master-combo": 4,
  "stand-visit": 5,
  "stand-explorer-combo": 6,
  "exhibitor-challenge": 7,
  "constructive-feedback": 8,
  "cross-course-networking": 9,
  "networking-triad-combo": 10,
  "nucleus-member-bonus": 11,
  "perfect-sequence-combo": 12,
  "balanced-explorer-combo": 13,
  "mentor-found-bonus": 14,
  "special-quiz": 15,
  "fair-surprise": 16,
  "point-battle": 17,
  "clue-chain": 18,
  "cooperative-mission": 19,
  "smart-recovery": 20,
  "journey-complete": 21,
};

export function orderPassportMissionsForMap<T extends PassportMissionOrderItem>(
  missions: T[],
) {
  return missions
    .map((mission, index) => ({ mission, index }))
    .sort((left, right) => {
      const leftPriority =
        PASSPORT_MISSION_PRIORITY[left.mission.key] ?? left.index + 100;
      const rightPriority =
        PASSPORT_MISSION_PRIORITY[right.mission.key] ?? right.index + 100;

      return leftPriority - rightPriority || left.index - right.index;
    })
    .map((item) => item.mission);
}
