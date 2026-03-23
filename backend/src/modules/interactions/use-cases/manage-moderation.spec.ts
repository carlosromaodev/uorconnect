import { describe, expect, it, vi } from "vitest";
import {
  DeleteLiveChatMessage,
  DeleteProjectComment,
  GetInteractionModerationOverview,
  type InteractionModerationRepository
} from "./manage-moderation";

function buildRepository(): InteractionModerationRepository {
  return {
    listProjectComments: vi.fn().mockResolvedValue([
      {
        id: 1,
        content: "Comentário",
        createdAt: new Date().toISOString(),
        studentName: "Ana",
        studentNumber: "20240001",
        course: "Informática",
        submissionId: 3,
        submissionName: "Projeto A"
      }
    ]),
    listLiveChatMessages: vi.fn().mockResolvedValue([
      {
        id: 2,
        content: "Mensagem",
        createdAt: new Date().toISOString(),
        studentName: "Bruno",
        studentNumber: "20240002",
        course: "Telecom",
        courseColor: "#2563eb"
      }
    ]),
    hasProjectComment: vi.fn().mockResolvedValue(true),
    deleteProjectComment: vi.fn().mockResolvedValue(undefined),
    hasLiveChatMessage: vi.fn().mockResolvedValue(true),
    deleteLiveChatMessage: vi.fn().mockResolvedValue(undefined)
  };
}

describe("interaction moderation use cases", () => {
  it("agrega comentários públicos e mini-chat para o admin", async () => {
    const repository = buildRepository();

    const result = await new GetInteractionModerationOverview(repository).execute();

    expect(result.projectComments).toHaveLength(1);
    expect(result.liveChatMessages).toHaveLength(1);
  });

  it("remove comentário público existente", async () => {
    const repository = buildRepository();

    const result = await new DeleteProjectComment(repository).execute(1);

    expect(result).toEqual({ success: true });
    expect(repository.deleteProjectComment).toHaveBeenCalledWith(1);
  });

  it("remove mensagem do mini-chat existente", async () => {
    const repository = buildRepository();

    const result = await new DeleteLiveChatMessage(repository).execute(2);

    expect(result).toEqual({ success: true });
    expect(repository.deleteLiveChatMessage).toHaveBeenCalledWith(2);
  });
});
