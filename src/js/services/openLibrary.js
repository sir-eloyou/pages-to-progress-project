export function getOpenLibraryCoverUrl({ coverId, isbn }) {
  if (coverId) {
    return `https://covers.openlibrary.org/b/id/${encodeURIComponent(coverId)}-M.jpg`;
  }
  if (isbn) {
    const cleanIsbn = String(isbn).replace(/[^0-9Xx]/g, "");
    if (cleanIsbn) {
      return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(cleanIsbn)}-M.jpg`;
    }
  }
  return null;
}

function parseTableOfContents(toc) {
  if (!Array.isArray(toc) || toc.length === 0) return [];

  return toc
    .map((entry, idx) => {
      const rawTitle =
        typeof entry === "string"
          ? entry
          : entry?.title || entry?.label || entry?.chapter || "";
      const cleaned = String(rawTitle).trim();
      if (!cleaned) return null;

      const prefixed = /^\d+[\.\):-]/.test(cleaned)
        ? cleaned
        : `${idx + 1}. ${cleaned}`;

      return {
        id: `ch-${idx + 1}-${Date.now()}`,
        title: prefixed,
        completed: false
      };
    })
    .filter(Boolean);
}

/**
 * Searches Open Library by title, author, or topic.
 * @param {string} query
 * @param {number} [limit=4]
 */
export async function searchOpenLibraryBooks(query, limit = 4) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];

  const fields = [
    "key",
    "title",
    "author_name",
    "first_publish_year",
    "number_of_pages_median",
    "cover_i",
    "isbn",
    "edition_key"
  ].join(",");

  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&limit=${limit}&fields=${fields}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library search failed (${response.status})`);
  }

  const data = await response.json();
  const docs = Array.isArray(data?.docs) ? data.docs : [];

  return docs.map((doc) => ({
    workKey: doc.key || null,
    editionKey: Array.isArray(doc.edition_key) ? doc.edition_key[0] : null,
    title: doc.title || "Untitled Book",
    author: Array.isArray(doc.author_name) && doc.author_name.length > 0
      ? doc.author_name.join(", ")
      : "Unknown Author",
    publishYear: doc.first_publish_year || null,
    totalPages: Number(doc.number_of_pages_median) || 0,
    chapters: [],
    description: "",
    coverUrl: getOpenLibraryCoverUrl({
      coverId: doc.cover_i,
      isbn: Array.isArray(doc.isbn) ? doc.isbn[0] : null
    })
  }));
}

/**
 * Enriches a search item with work description and edition pages/chapters when available.
 */
export async function fetchOpenLibraryBookDetails(book) {
  const enriched = { ...book };

  if (book.workKey) {
    try {
      const workRes = await fetch(`https://openlibrary.org${book.workKey}.json`);
      if (workRes.ok) {
        const work = await workRes.json();
        const desc = typeof work.description === "string"
          ? work.description
          : work.description?.value || "";
        enriched.description = desc.trim();
      }
    } catch {
      // Ignore optional work fetch failure
    }
  }

  if (book.editionKey) {
    try {
      const edRes = await fetch(`https://openlibrary.org/books/${encodeURIComponent(book.editionKey)}.json`);
      if (edRes.ok) {
        const ed = await edRes.json();
        if (Number(ed.number_of_pages) > 0) {
          enriched.totalPages = Number(ed.number_of_pages);
        }
        const parsedChapters = parseTableOfContents(ed.table_of_contents);
        if (parsedChapters.length > 0) {
          enriched.chapters = parsedChapters;
        }
      }
    } catch {
      // Ignore optional edition fetch failure
    }
  }

  return enriched;
}