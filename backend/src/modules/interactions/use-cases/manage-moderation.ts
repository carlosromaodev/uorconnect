export type ModerationProjectComment = {
  id: number;
  content: string;
  createdAt: string;
  studentName: string;
  studentNumber: string;
  course: string | null;
  submissionId: number;
  submissionName: string;
};

export type ModerationLiveChatMessage = {
  id: number;
  content: string;
  createdAt: string;
  studentName: string;
  studentNumber: string;
  course: string | null;
  courseColor: string | null;
};

export interface InteractionModerationRepository {
  listProjectComments(): Promise<ModerationProjectComment[]>;
  listLiveChatMessages(): Promise<ModerationLiveChatMessage[]>;
  hasProjectComment(id: number): Promise<boolean>;
  deleteProjectComment(id: number): Promise<void>;
  hasLiveChatMessage(id: number): Promise<boolean>;
  deleteLiveChatMessage(id: number): Promise<void>;
}

export class GetInteractionModerationOverview {
  constructor(private readonly repository: InteractionModerationRepository) {}

  async execute() {
    const [projectComments, liveChatMessages] = await Promise.all([
      this.repository.listProjectComments(),
      this.repository.listLiveChatMessages()
    ]);

    return { projectComments, liveChatMessages };
  }
}

export class DeleteProjectComment {
  constructor(private readonly repository: InteractionModerationRepository) {}

  async execute(id: number) {
    const exists = await this.repository.hasProjectComment(id);
    if (!exists) {
      throw new Error("Project comment not found");
    }

    await this.repository.deleteProjectComment(id);
    return { success: true as const };
  }
}

export class DeleteLiveChatMessage {
  constructor(private readonly repository: InteractionModerationRepository) {}

  async execute(id: number) {
    const exists = await this.repository.hasLiveChatMessage(id);
    if (!exists) {
      throw new Error("Live chat message not found");
    }

    await this.repository.deleteLiveChatMessage(id);
    return { success: true as const };
  }
}
