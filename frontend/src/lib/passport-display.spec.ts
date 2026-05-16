import { describe, expect, it } from "vitest";
import {
  getPassportDisplayPoints,
  getPassportJoinAwardedPoints,
  shouldShowPassportCelebrationPoints,
} from "./passport-display";

describe("passport display helpers", () => {
  it("uses the accepted challenge mission points when showing the join celebration", () => {
    expect(
      getPassportJoinAwardedPoints({
        points: 10,
        missions: [
          {
            key: "accept-challenge",
            points: 10,
            pointsEarned: 10,
            completions: 1,
            status: "done",
          },
        ],
      }),
    ).toBe(10);
  });

  it("does not ask celebration cards to render a zero-point score", () => {
    expect(shouldShowPassportCelebrationPoints(0)).toBe(false);
    expect(shouldShowPassportCelebrationPoints(10)).toBe(true);
    expect(shouldShowPassportCelebrationPoints(-10)).toBe(true);
  });

  it("does not show zero total points when the accepted challenge mission is already done", () => {
    expect(
      getPassportDisplayPoints(
        {
          points: 0,
          missions: [
            {
              key: "accept-challenge",
              points: 10,
              pointsEarned: 0,
              completions: 1,
              status: "done",
            },
          ],
        },
        0,
      ),
    ).toBe(10);
  });
});
