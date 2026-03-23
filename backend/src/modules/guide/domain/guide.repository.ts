import type { GuideStep, GuideTip, Venue } from "@prisma/client";

export type GuideStepInput = {
  title: string;
  description: string;
  link?: string | null;
  linkText?: string | null;
  icon: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export type GuideTipInput = {
  content: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export type VenueInput = {
  name: string;
  description: string;
  capacity: string;
  floor: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export interface GuideRepository {
  listSteps(includeDrafts?: boolean): Promise<GuideStep[]>;
  findStepById(id: number): Promise<GuideStep | null>;
  createStep(data: GuideStepInput): Promise<GuideStep>;
  updateStep(id: number, data: GuideStepInput): Promise<GuideStep>;
  deleteStep(id: number): Promise<void>;

  listTips(includeDrafts?: boolean): Promise<GuideTip[]>;
  findTipById(id: number): Promise<GuideTip | null>;
  createTip(data: GuideTipInput): Promise<GuideTip>;
  updateTip(id: number, data: GuideTipInput): Promise<GuideTip>;
  deleteTip(id: number): Promise<void>;

  listVenues(includeDrafts?: boolean): Promise<Venue[]>;
  findVenueById(id: number): Promise<Venue | null>;
  createVenue(data: VenueInput): Promise<Venue>;
  updateVenue(id: number, data: VenueInput): Promise<Venue>;
  deleteVenue(id: number): Promise<void>;
}
