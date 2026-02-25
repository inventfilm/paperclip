import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { projects, projectGoals, goals, projectWorkspaces } from "@paperclip/db";
import { PROJECT_COLORS, type ProjectGoalRef, type ProjectWorkspace } from "@paperclip/shared";

type ProjectRow = typeof projects.$inferSelect;
type ProjectWorkspaceRow = typeof projectWorkspaces.$inferSelect;

interface ProjectWithGoals extends ProjectRow {
  goalIds: string[];
  goals: ProjectGoalRef[];
  workspaces: ProjectWorkspace[];
  primaryWorkspace: ProjectWorkspace | null;
}

/** Batch-load goal refs for a set of projects. */
async function attachGoals(db: Db, rows: ProjectRow[]): Promise<ProjectWithGoals[]> {
  if (rows.length === 0) return [];

  const projectIds = rows.map((r) => r.id);

  // Fetch join rows + goal titles in one query
  const links = await db
    .select({
      projectId: projectGoals.projectId,
      goalId: projectGoals.goalId,
      goalTitle: goals.title,
    })
    .from(projectGoals)
    .innerJoin(goals, eq(projectGoals.goalId, goals.id))
    .where(inArray(projectGoals.projectId, projectIds));

  const map = new Map<string, ProjectGoalRef[]>();
  for (const link of links) {
    let arr = map.get(link.projectId);
    if (!arr) {
      arr = [];
      map.set(link.projectId, arr);
    }
    arr.push({ id: link.goalId, title: link.goalTitle });
  }

  return rows.map((r) => {
    const g = map.get(r.id) ?? [];
    return { ...r, goalIds: g.map((x) => x.id), goals: g } as ProjectWithGoals;
  });
}

function toWorkspace(row: ProjectWorkspaceRow): ProjectWorkspace {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    name: row.name,
    cwd: row.cwd,
    repoUrl: row.repoUrl ?? null,
    repoRef: row.repoRef ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function pickPrimaryWorkspace(rows: ProjectWorkspaceRow[]): ProjectWorkspace | null {
  if (rows.length === 0) return null;
  const explicitPrimary = rows.find((row) => row.isPrimary);
  return toWorkspace(explicitPrimary ?? rows[0]);
}

/** Batch-load workspace refs for a set of projects. */
async function attachWorkspaces(db: Db, rows: ProjectWithGoals[]): Promise<ProjectWithGoals[]> {
  if (rows.length === 0) return [];

  const projectIds = rows.map((r) => r.id);
  const workspaceRows = await db
    .select()
    .from(projectWorkspaces)
    .where(inArray(projectWorkspaces.projectId, projectIds))
    .orderBy(desc(projectWorkspaces.isPrimary), asc(projectWorkspaces.createdAt), asc(projectWorkspaces.id));

  const map = new Map<string, ProjectWorkspaceRow[]>();
  for (const row of workspaceRows) {
    let arr = map.get(row.projectId);
    if (!arr) {
      arr = [];
      map.set(row.projectId, arr);
    }
    arr.push(row);
  }

  return rows.map((row) => {
    const projectWorkspaceRows = map.get(row.id) ?? [];
    const workspaces = projectWorkspaceRows.map(toWorkspace);
    return {
      ...row,
      workspaces,
      primaryWorkspace: pickPrimaryWorkspace(projectWorkspaceRows),
    };
  });
}

/** Sync the project_goals join table for a single project. */
async function syncGoalLinks(db: Db, projectId: string, companyId: string, goalIds: string[]) {
  // Delete existing links
  await db.delete(projectGoals).where(eq(projectGoals.projectId, projectId));

  // Insert new links
  if (goalIds.length > 0) {
    await db.insert(projectGoals).values(
      goalIds.map((goalId) => ({ projectId, goalId, companyId })),
    );
  }
}

/** Resolve goalIds from input, handling the legacy goalId field. */
function resolveGoalIds(data: { goalIds?: string[]; goalId?: string | null }): string[] | undefined {
  if (data.goalIds !== undefined) return data.goalIds;
  if (data.goalId !== undefined) {
    return data.goalId ? [data.goalId] : [];
  }
  return undefined;
}

async function ensureSinglePrimaryWorkspace(
  dbOrTx: any,
  input: {
    companyId: string;
    projectId: string;
    keepWorkspaceId: string;
  },
) {
  await dbOrTx
    .update(projectWorkspaces)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(
      and(
        eq(projectWorkspaces.companyId, input.companyId),
        eq(projectWorkspaces.projectId, input.projectId),
      ),
    );

  await dbOrTx
    .update(projectWorkspaces)
    .set({ isPrimary: true, updatedAt: new Date() })
    .where(
      and(
        eq(projectWorkspaces.companyId, input.companyId),
        eq(projectWorkspaces.projectId, input.projectId),
        eq(projectWorkspaces.id, input.keepWorkspaceId),
      ),
    );
}

export function projectService(db: Db) {
  return {
    list: async (companyId: string): Promise<ProjectWithGoals[]> => {
      const rows = await db.select().from(projects).where(eq(projects.companyId, companyId));
      const withGoals = await attachGoals(db, rows);
      return attachWorkspaces(db, withGoals);
    },

    getById: async (id: string): Promise<ProjectWithGoals | null> => {
      const row = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .then((rows) => rows[0] ?? null);
      if (!row) return null;
      const [withGoals] = await attachGoals(db, [row]);
      if (!withGoals) return null;
      const [enriched] = await attachWorkspaces(db, [withGoals]);
      return enriched ?? null;
    },

    create: async (
      companyId: string,
      data: Omit<typeof projects.$inferInsert, "companyId"> & { goalIds?: string[] },
    ): Promise<ProjectWithGoals> => {
      const { goalIds: inputGoalIds, ...projectData } = data;
      const ids = resolveGoalIds({ goalIds: inputGoalIds, goalId: projectData.goalId });

      // Auto-assign a color from the palette if none provided
      if (!projectData.color) {
        const existing = await db.select({ color: projects.color }).from(projects).where(eq(projects.companyId, companyId));
        const usedColors = new Set(existing.map((r) => r.color).filter(Boolean));
        const nextColor = PROJECT_COLORS.find((c) => !usedColors.has(c)) ?? PROJECT_COLORS[existing.length % PROJECT_COLORS.length];
        projectData.color = nextColor;
      }

      // Also write goalId to the legacy column (first goal or null)
      const legacyGoalId = ids && ids.length > 0 ? ids[0] : projectData.goalId ?? null;

      const row = await db
        .insert(projects)
        .values({ ...projectData, goalId: legacyGoalId, companyId })
        .returning()
        .then((rows) => rows[0]);

      if (ids && ids.length > 0) {
        await syncGoalLinks(db, row.id, companyId, ids);
      }

      const [withGoals] = await attachGoals(db, [row]);
      const [enriched] = withGoals ? await attachWorkspaces(db, [withGoals]) : [];
      return enriched!;
    },

    update: async (
      id: string,
      data: Partial<typeof projects.$inferInsert> & { goalIds?: string[] },
    ): Promise<ProjectWithGoals | null> => {
      const { goalIds: inputGoalIds, ...projectData } = data;
      const ids = resolveGoalIds({ goalIds: inputGoalIds, goalId: projectData.goalId });

      // Keep legacy goalId column in sync
      const updates: Partial<typeof projects.$inferInsert> = {
        ...projectData,
        updatedAt: new Date(),
      };
      if (ids !== undefined) {
        updates.goalId = ids.length > 0 ? ids[0] : null;
      }

      const row = await db
        .update(projects)
        .set(updates)
        .where(eq(projects.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!row) return null;

      if (ids !== undefined) {
        await syncGoalLinks(db, id, row.companyId, ids);
      }

      const [withGoals] = await attachGoals(db, [row]);
      const [enriched] = withGoals ? await attachWorkspaces(db, [withGoals]) : [];
      return enriched ?? null;
    },

    remove: (id: string) =>
      db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    listWorkspaces: async (projectId: string): Promise<ProjectWorkspace[]> => {
      const rows = await db
        .select()
        .from(projectWorkspaces)
        .where(eq(projectWorkspaces.projectId, projectId))
        .orderBy(desc(projectWorkspaces.isPrimary), asc(projectWorkspaces.createdAt), asc(projectWorkspaces.id));
      return rows.map(toWorkspace);
    },

    createWorkspace: async (
      projectId: string,
      data: Omit<typeof projectWorkspaces.$inferInsert, "projectId" | "companyId">,
    ): Promise<ProjectWorkspace | null> => {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .then((rows) => rows[0] ?? null);
      if (!project) return null;

      const existing = await db
        .select()
        .from(projectWorkspaces)
        .where(eq(projectWorkspaces.projectId, projectId))
        .orderBy(asc(projectWorkspaces.createdAt))
        .then((rows) => rows);

      const shouldBePrimary = data.isPrimary === true || existing.length === 0;
      const created = await db.transaction(async (tx) => {
        if (shouldBePrimary) {
          await tx
            .update(projectWorkspaces)
            .set({ isPrimary: false, updatedAt: new Date() })
            .where(
              and(
                eq(projectWorkspaces.companyId, project.companyId),
                eq(projectWorkspaces.projectId, projectId),
              ),
            );
        }

        const row = await tx
          .insert(projectWorkspaces)
          .values({
            companyId: project.companyId,
            projectId,
            name: data.name,
            cwd: data.cwd,
            repoUrl: data.repoUrl ?? null,
            repoRef: data.repoRef ?? null,
            metadata: (data.metadata as Record<string, unknown> | null | undefined) ?? null,
            isPrimary: shouldBePrimary,
          })
          .returning()
          .then((rows) => rows[0] ?? null);
        return row;
      });

      return created ? toWorkspace(created) : null;
    },

    updateWorkspace: async (
      projectId: string,
      workspaceId: string,
      data: Partial<typeof projectWorkspaces.$inferInsert>,
    ): Promise<ProjectWorkspace | null> => {
      const existing = await db
        .select()
        .from(projectWorkspaces)
        .where(
          and(
            eq(projectWorkspaces.id, workspaceId),
            eq(projectWorkspaces.projectId, projectId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!existing) return null;

      const patch: Partial<typeof projectWorkspaces.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (data.name !== undefined) patch.name = data.name;
      if (data.cwd !== undefined) patch.cwd = data.cwd;
      if (data.repoUrl !== undefined) patch.repoUrl = data.repoUrl;
      if (data.repoRef !== undefined) patch.repoRef = data.repoRef;
      if (data.metadata !== undefined) patch.metadata = data.metadata;

      const updated = await db.transaction(async (tx) => {
        if (data.isPrimary === true) {
          await tx
            .update(projectWorkspaces)
            .set({ isPrimary: false, updatedAt: new Date() })
            .where(
              and(
                eq(projectWorkspaces.companyId, existing.companyId),
                eq(projectWorkspaces.projectId, projectId),
              ),
            );
          patch.isPrimary = true;
        } else if (data.isPrimary === false) {
          patch.isPrimary = false;
        }

        const row = await tx
          .update(projectWorkspaces)
          .set(patch)
          .where(eq(projectWorkspaces.id, workspaceId))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!row) return null;

        if (row.isPrimary) return row;

        const hasPrimary = await tx
          .select({ id: projectWorkspaces.id })
          .from(projectWorkspaces)
          .where(
            and(
              eq(projectWorkspaces.companyId, row.companyId),
              eq(projectWorkspaces.projectId, row.projectId),
              eq(projectWorkspaces.isPrimary, true),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!hasPrimary) {
          const nextPrimaryCandidate = await tx
            .select({ id: projectWorkspaces.id })
            .from(projectWorkspaces)
            .where(
              and(
                eq(projectWorkspaces.companyId, row.companyId),
                eq(projectWorkspaces.projectId, row.projectId),
                eq(projectWorkspaces.id, row.id),
              ),
            )
            .then((rows) => rows[0] ?? null);
          const alternateCandidate = await tx
            .select({ id: projectWorkspaces.id })
            .from(projectWorkspaces)
            .where(
              and(
                eq(projectWorkspaces.companyId, row.companyId),
                eq(projectWorkspaces.projectId, row.projectId),
              ),
            )
            .orderBy(asc(projectWorkspaces.createdAt), asc(projectWorkspaces.id))
            .then((rows) => rows.find((candidate) => candidate.id !== row.id) ?? null);

          await ensureSinglePrimaryWorkspace(tx, {
            companyId: row.companyId,
            projectId: row.projectId,
            keepWorkspaceId: alternateCandidate?.id ?? nextPrimaryCandidate?.id ?? row.id,
          });
          const refreshed = await tx
            .select()
            .from(projectWorkspaces)
            .where(eq(projectWorkspaces.id, row.id))
            .then((rows) => rows[0] ?? row);
          return refreshed;
        }

        return row;
      });

      return updated ? toWorkspace(updated) : null;
    },

    removeWorkspace: async (projectId: string, workspaceId: string): Promise<ProjectWorkspace | null> => {
      const existing = await db
        .select()
        .from(projectWorkspaces)
        .where(
          and(
            eq(projectWorkspaces.id, workspaceId),
            eq(projectWorkspaces.projectId, projectId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!existing) return null;

      const removed = await db.transaction(async (tx) => {
        const row = await tx
          .delete(projectWorkspaces)
          .where(eq(projectWorkspaces.id, workspaceId))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!row) return null;

        if (!row.isPrimary) return row;

        const next = await tx
          .select()
          .from(projectWorkspaces)
          .where(
            and(
              eq(projectWorkspaces.companyId, row.companyId),
              eq(projectWorkspaces.projectId, row.projectId),
            ),
          )
          .orderBy(asc(projectWorkspaces.createdAt), asc(projectWorkspaces.id))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (next) {
          await ensureSinglePrimaryWorkspace(tx, {
            companyId: row.companyId,
            projectId: row.projectId,
            keepWorkspaceId: next.id,
          });
        }

        return row;
      });

      return removed ? toWorkspace(removed) : null;
    },
  };
}
