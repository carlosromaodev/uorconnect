import { prisma } from "../shared/prisma";
import {
  DEFAULT_EXHIBITOR_SCORE_CONFIG,
  calculateExhibitorScoreEvent,
  normalizeScoreCourse,
} from "../modules/exhibitor-scoring/application/exhibitor-scoring.rules";
import { isCompetitionEligible } from "../modules/submission/domain/submission-policy";

const EVENT_KEY = process.env.EXHIBITOR_SCORE_EVENT_KEY ?? "main-event";

function sameStudentNumber(left?: string | null, right?: string | null) {
  const normalizedLeft = (left ?? "").trim();
  const normalizedRight = (right ?? "").trim();
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function stringifyMetadata(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

async function main() {
  const removed = await prisma.exhibitorScoreEvent.deleteMany({
    where: {
      eventKey: EVENT_KEY,
      sourceType: { in: ["STUDENT_VOTE", "SELF_VOTE_ATTEMPT"] },
      lockedAt: null,
    },
  });

  const votes = await prisma.studentVote.findMany({
    include: {
      student: {
        select: {
          id: true,
          studentNumber: true,
          name: true,
          course: true,
        },
      },
      submission: {
        include: {
          memberConfirmations: {
            select: {
              id: true,
              studentId: true,
              studentNumber: true,
              expectedStudentNumber: true,
              confirmedAt: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const reachedCoursesBySubmission = new Map<number, Set<string>>();
  let validVoteEvents = 0;
  let firstCourseBonusEvents = 0;
  let cancelledSelfVoteEvents = 0;
  let ignoredVotes = 0;

  for (const vote of votes) {
    const submission = vote.submission;
    if (
      submission.deletedAt
      || submission.status !== "APPROVED"
      || !isCompetitionEligible(submission.type, submission.area)
    ) {
      ignoredVotes += 1;
      continue;
    }

    const member = submission.memberConfirmations.find((item) => (
      item.confirmedAt
      && (
        item.studentId === vote.studentId
        || sameStudentNumber(item.studentNumber, vote.student.studentNumber)
        || sameStudentNumber(item.expectedStudentNumber, vote.student.studentNumber)
      )
    ));
    const selfVote = submission.studentId === vote.studentId
      || sameStudentNumber(submission.studentNumberSnapshot, vote.student.studentNumber)
      || Boolean(member);

    if (selfVote) {
      const cancelled = calculateExhibitorScoreEvent({
        action: "SELF_VOTE_ATTEMPT",
        submissionCourse: submission.course,
        voterCourse: vote.student.course,
        config: DEFAULT_EXHIBITOR_SCORE_CONFIG,
      });
      await prisma.exhibitorScoreEvent.upsert({
        where: { businessKey: `self-vote-attempt:${EVENT_KEY}:${submission.id}:${vote.studentId}` },
        update: {},
        create: {
          businessKey: `self-vote-attempt:${EVENT_KEY}:${submission.id}:${vote.studentId}`,
          eventKey: EVENT_KEY,
          submissionId: submission.id,
          studentId: vote.studentId,
          actorStudentId: vote.studentId,
          submissionMemberId: member?.id ?? null,
          sourceType: "SELF_VOTE_ATTEMPT",
          sourceId: String(vote.id),
          action: "SELF_VOTE_ATTEMPT",
          role: "STUDENT",
          voterCourse: vote.student.course ?? null,
          submissionCourse: submission.course ?? null,
          basePoints: cancelled.basePoints,
          bonusPoints: cancelled.bonusPoints,
          multiplier: cancelled.multiplier,
          points: cancelled.points,
          status: "CANCELLED",
          reason: cancelled.reason,
          metadataJson: stringifyMetadata({
            backfilled: true,
            voteId: vote.id,
            studentNumber: vote.student.studentNumber,
            submissionName: submission.name,
          }),
          scoreConfigVersion: DEFAULT_EXHIBITOR_SCORE_CONFIG.version,
          awardedAt: vote.createdAt,
        },
      });
      cancelledSelfVoteEvents += 1;
      continue;
    }

    const score = calculateExhibitorScoreEvent({
      action: "STUDENT_VOTE",
      submissionCourse: submission.course,
      voterCourse: vote.student.course,
      roundMultiplier: 1,
      config: DEFAULT_EXHIBITOR_SCORE_CONFIG,
    });
    await prisma.exhibitorScoreEvent.upsert({
      where: { businessKey: `student-vote:${EVENT_KEY}:${submission.id}:${vote.studentId}` },
      update: {},
      create: {
        businessKey: `student-vote:${EVENT_KEY}:${submission.id}:${vote.studentId}`,
        eventKey: EVENT_KEY,
        submissionId: submission.id,
        studentId: vote.studentId,
        actorStudentId: vote.studentId,
        sourceType: "STUDENT_VOTE",
        sourceId: String(vote.id),
        action: "STUDENT_VOTE",
        role: "STUDENT",
        voterCourse: vote.student.course ?? null,
        submissionCourse: submission.course ?? null,
        basePoints: score.basePoints,
        bonusPoints: 0,
        multiplier: score.multiplier,
        points: score.points,
        status: "VALID",
        reason: score.reason,
        metadataJson: stringifyMetadata({
          backfilled: true,
          voteId: vote.id,
          studentNumber: vote.student.studentNumber,
          studentName: vote.student.name,
        }),
        scoreConfigVersion: DEFAULT_EXHIBITOR_SCORE_CONFIG.version,
        awardedAt: vote.createdAt,
      },
    });
    validVoteEvents += 1;

    const courseKey = normalizeScoreCourse(vote.student.course) || "curso-por-confirmar";
    const reachedCourses = reachedCoursesBySubmission.get(submission.id) ?? new Set<string>();
    if (!reachedCourses.has(courseKey)) {
      reachedCourses.add(courseKey);
      reachedCoursesBySubmission.set(submission.id, reachedCourses);
      const bonusPoints = DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.firstCourseVoteBonus * score.multiplier;
      await prisma.exhibitorScoreEvent.upsert({
        where: { businessKey: `first-course-vote:${EVENT_KEY}:${submission.id}:${courseKey}` },
        update: {},
        create: {
          businessKey: `first-course-vote:${EVENT_KEY}:${submission.id}:${courseKey}`,
          eventKey: EVENT_KEY,
          submissionId: submission.id,
          studentId: vote.studentId,
          actorStudentId: vote.studentId,
          sourceType: "STUDENT_VOTE",
          sourceId: String(vote.id),
          action: "FIRST_COURSE_VOTE_BONUS",
          role: "STUDENT",
          voterCourse: vote.student.course ?? null,
          submissionCourse: submission.course ?? null,
          basePoints: 0,
          bonusPoints: DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.firstCourseVoteBonus,
          multiplier: score.multiplier,
          points: bonusPoints,
          status: "VALID",
          reason: "Primeiro voto vindo deste curso",
          metadataJson: stringifyMetadata({
            backfilled: true,
            voteId: vote.id,
            courseKey,
            studentNumber: vote.student.studentNumber,
          }),
          scoreConfigVersion: DEFAULT_EXHIBITOR_SCORE_CONFIG.version,
          awardedAt: vote.createdAt,
        },
      });
      firstCourseBonusEvents += 1;
    }
  }

  console.log(JSON.stringify({
    eventKey: EVENT_KEY,
    removedScoreEvents: removed.count,
    validVoteEvents,
    firstCourseBonusEvents,
    cancelledSelfVoteEvents,
    ignoredVotes,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
