import type { GoalLevel } from "../constants.js";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  parentId: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
