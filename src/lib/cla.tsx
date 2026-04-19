import { extract } from "@std/front-matter/yaml";
import { z } from "zod";
import { type ComponentChildren, createContext } from "preact";
import { useContext } from "preact/hooks";

export const ClaFrontmatter = z.object({
  name: z.string().min(1),
  // Accept a "X.Y" string or a YAML number. YAML floats like 1.0 collapse to the
  // JS integer 1, so we re-append ".0" for integers before the regex check.
  version: z.union([z.string(), z.number()])
    .transform((v) => {
      if (typeof v === "number") {
        return Number.isInteger(v) ? `${v}.0` : String(v);
      }
      return v;
    })
    .pipe(z.string().regex(/^\d+\.\d+$/, 'version must match "X.Y"')),
});

export type ClaFrontmatter = z.infer<typeof ClaFrontmatter>;

export interface ParsedCLA extends ClaFrontmatter {
  body: string;
}

export type ParseResult =
  | { ok: true; cla: ParsedCLA }
  | { ok: false; issues: string[] };

export function parseCLA(text: string): ParseResult {
  let fm;
  try {
    fm = extract(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      issues: [`could not parse YAML frontmatter: ${msg}`],
    };
  }
  const parsed = ClaFrontmatter.safeParse(fm.attrs);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => {
        const field = i.path.length ? i.path.join(".") : "(root)";
        return `${field}: ${i.message}`;
      }),
    };
  }
  return { ok: true, cla: { ...parsed.data, body: fm.body } };
}

/** The CLA being signed, plus the repo it came from. */
export interface CLAContextValue {
  cla: ParsedCLA;
  forge: string;
  owner: string;
  repo: string;
}

const Ctx = createContext<CLAContextValue | null>(null);

export function CLAProvider(
  { value, children }: {
    value: CLAContextValue;
    children: ComponentChildren;
  },
) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCLA(): CLAContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("CLAProvider missing");
  return v;
}
