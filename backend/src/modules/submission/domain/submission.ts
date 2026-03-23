export type SubmissionType = "PROJECT" | "BUSINESS" | "PRODUCT";
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Submission = {
  id: number;
  referenceCode: string;
  type: SubmissionType;
  status: SubmissionStatus;
  name: string;
  description: string;
  area: string;
  course?: string | null;
  stage?: string | null;
  category?: string | null;
  productType?: string | null;
  teamSize: number;
  members: string[];
  leaderName?: string | null;
  leaderPhone?: string | null;
  leaderEmail?: string | null;
  needs: string[];
  paymentProof: string;
  paymentConfirmed: boolean;
  repoUrl?: string | null;
  websiteUrl?: string | null;
  observations?: string | null;
  agreeRules: boolean;
  primaryColor: string;
  secondaryColor: string;
  bannerUrl?: string | null;
  isWinner: boolean;
  winnerSelectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubmissionConfig = {
  key: string;
  isOpen: boolean;
  iban: string;
  accountName: string;
  paymentAmount: string;
  paymentInstructions?: string | null;
  projectCommunityUrl?: string | null;
  businessCommunityUrl?: string | null;
  productCommunityUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubmissionSummary = Submission & {
  votes: number;
  averageRating: number;
  reviews: Array<{
    user: string;
    rating: number;
    comment?: string | null;
    createdAt: Date;
  }>;
};
