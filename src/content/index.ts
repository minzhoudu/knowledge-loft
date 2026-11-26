import { z } from "zod";
import * as raw from "./data";
import { AboutSchema, CompanySchema, HobbySchema, ProjectSchema } from "./schema";

/** Validated content. Import from here, never from ./data directly. */
export const about = AboutSchema.parse(raw.about);
export const projects = z
  .array(ProjectSchema)
  .parse(raw.projects)
  .sort((a, b) => b.year - a.year);
export const companies = z
  .array(CompanySchema)
  .parse(raw.companies)
  .sort((a, b) => b.start.localeCompare(a.start));
export const hobbies = z.array(HobbySchema).parse(raw.hobbies);

export type { About, Company, Hobby, Project } from "./schema";

export function formatRange(start: string, end: string | null) {
  const fmt = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en", { month: "short", year: "numeric" });
  };
  return `${fmt(start)} – ${end ? fmt(end) : "Present"}`;
}
