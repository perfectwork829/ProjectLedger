export interface WorkHistoryEntry {
  title: string;
  overview: string;
  start_date: string;
  end_date: string;
}

export interface ProfileBlock {
  title: string;
  overview: string;
  skills: string[];
  achievements: string[];
  experience: WorkHistoryEntry[];
}

function parseTextItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
}

export function parseProfileBlocks(raw: unknown): ProfileBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const obj = (x || {}) as Record<string, unknown>;
    const expRaw = Array.isArray(obj.experience) ? obj.experience : [];
    return {
      title: String(obj.title || ''),
      overview: String(obj.overview || ''),
      skills: parseTextItems(obj.skills),
      achievements: parseTextItems(obj.achievements),
      experience: expRaw.map((e) => {
        const eo = (e || {}) as Record<string, unknown>;
        return {
          title: String(eo.title || ''),
          overview: String(eo.overview || ''),
          start_date: String(eo.start_date || ''),
          end_date: String(eo.end_date || ''),
        };
      }),
    };
  });
}
