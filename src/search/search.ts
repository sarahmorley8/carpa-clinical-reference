/**
 * Offline search over presentation names, keywords, symptoms, body systems and
 * approved synonym groups. Tolerates small spelling mistakes. Search only finds
 * presentations; it never suggests a diagnosis or treatment.
 */
import MiniSearch from 'minisearch';
import type { ContentStore } from '../content/validate.ts';

export interface SearchResult {
  id: string;
  title: string;
}

interface Doc {
  id: string;
  title: string;
  keywords: string;
  symptoms: string;
  systems: string;
  synonyms: string;
}

export interface SearchIndex {
  search(query: string): SearchResult[];
}

export function buildSearchIndex(store: ContentStore): SearchIndex {
  const groups = [...store.refs.synonyms.values()].map((g) => g.terms.map((t) => t.toLowerCase()));
  const docs: Doc[] = [...store.presentations.values()].map(({ data }) => {
    const keywords = data.keywords.join(' ');
    const symptoms = (data.symptoms ?? []).join(' ');
    const haystack = `${data.meta.title} ${keywords} ${symptoms}`.toLowerCase();
    const synonyms = groups.filter((terms) => terms.some((t) => haystack.includes(t))).flat();
    return {
      id: data.meta.id,
      title: data.meta.title,
      keywords,
      symptoms,
      systems: data.bodySystems.map((s) => store.refs['body-systems'].get(s)?.label ?? s).join(' '),
      synonyms: synonyms.join(' '),
    };
  });

  const mini = new MiniSearch<Doc>({
    fields: ['title', 'keywords', 'symptoms', 'systems', 'synonyms'],
    storeFields: ['title'],
    searchOptions: {
      boost: { title: 3, keywords: 2, synonyms: 2 },
      prefix: true,
      fuzzy: (term) => (term.length > 3 ? 0.25 : false),
    },
  });
  mini.addAll(docs);

  return {
    search(query: string): SearchResult[] {
      const q = query.trim();
      if (!q) return [];
      let hits = mini.search(q, { combineWith: 'AND' });
      if (hits.length === 0) hits = mini.search(q, { combineWith: 'OR' });
      return hits.map((h) => ({ id: String(h.id), title: String(h.title) }));
    },
  };
}
