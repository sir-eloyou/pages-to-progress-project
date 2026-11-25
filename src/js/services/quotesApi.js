const READING_KEYWORDS = [
  "read",
  "reading",
  "reader",
  "book",
  "books",
  "library",
  "pages",
  "page",
  "novel",
  "novels",
  "story",
  "stories",
  "author",
  "literacy",
  "literature",
  "word",
  "words"
];

const FALLBACK_READING_QUOTES = [
  {
    text: "A reader lives a thousand lives before he dies. The man who never reads lives only one.",
    author: "George R. R. Martin",
    source: "curated"
  },
  {
    text: "Books are a uniquely portable magic.",
    author: "Stephen King",
    source: "curated"
  },
  {
    text: "The reading of all good books is like a conversation with the finest minds of past centuries.",
    author: "René Descartes",
    source: "curated"
  },
  {
    text: "A room without books is like a body without a soul.",
    author: "Marcus Tullius Cicero",
    source: "curated"
  },
  {
    text: "We read to know we are not alone.",
    author: "William Nicholson",
    source: "curated"
  },
  {
    text: "Reading is to the mind what exercise is to the body.",
    author: "Joseph Addison",
    source: "curated"
  }
];

let cachedReadingQuotes = [];
let lastIndex = -1;

function isReadingQuote(text = "") {
  const lower = String(text).toLowerCase();
  return READING_KEYWORDS.some((word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    return pattern.test(lower);
  });
}

async function fetchFromDummyJson() {
  const res = await fetch("https://dummyjson.com/quotes?limit=100");
  if (!res.ok) throw new Error(`DummyJSON HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.quotes) ? data.quotes : [];

  return list
    .filter((item) => isReadingQuote(item.quote))
    .map((item) => ({
      text: String(item.quote).trim(),
      author: String(item.author || "Unknown Author").trim(),
      source: "api"
    }));
}

async function fetchFromQuotable() {
  const res = await fetch("https://api.quotable.io/quotes?limit=50");
  if (!res.ok) throw new Error(`Quotable HTTP ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  return results
    .filter((item) => {
      const hasReadingTag = Array.isArray(item.tags) &&
        item.tags.some((t) => ["books", "reading", "literature"].includes(String(t).toLowerCase()));
      return hasReadingTag || isReadingQuote(item.content);
    })
    .map((item) => ({
      text: String(item.content).trim(),
      author: String(item.author || "Unknown Author").trim(),
      source: "api"
    }));
}

function deduplicateQuotes(quotes) {
  const seen = new Set();
  return quotes.filter((q) => {
    const key = q.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchReadingQuote({ forceRefresh = false } = {}) {
  if (forceRefresh || cachedReadingQuotes.length === 0) {
    const settled = await Promise.allSettled([
      fetchFromDummyJson()
    ]);

    const apiQuotes = settled
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const combined = deduplicateQuotes([...apiQuotes, ...FALLBACK_READING_QUOTES]);
    cachedReadingQuotes = combined.length > 0 ? combined : FALLBACK_READING_QUOTES;
  }

  let nextIndex = Math.floor(Math.random() * cachedReadingQuotes.length);
  if (cachedReadingQuotes.length > 1 && nextIndex === lastIndex) {
    nextIndex = (lastIndex + 1) % cachedReadingQuotes.length;
  }
  lastIndex = nextIndex;

  return cachedReadingQuotes[nextIndex];
}