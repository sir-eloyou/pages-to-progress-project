const CHALLENGE_KEY = "ptp_reading_challenge";
const BOOKS_KEY = "ptp_books";

export function startReadingChallenge(durationDays = 365, bookGoal = 20) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(now.getDate() + durationDays);

  const payload = {
    startedAt: now.toISOString(),
    endDate: endDate.toISOString(),
    durationDays,
    bookGoal
  };

  localStorage.setItem(CHALLENGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("ptp:books-updated"));
  return payload;
}

export function getChallengeStatus() {
  const raw = localStorage.getItem(CHALLENGE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = new Date(data.endDate).getTime() - Date.now();
    const daysLeft = Math.max(0, Math.ceil(diffMs / msPerDay));

    return {
      daysLeft,
      isCompleted: daysLeft === 0,
      bookGoal: Number(data.bookGoal) || 20
    };
  } catch {
    localStorage.removeItem(CHALLENGE_KEY);
    return null;
  }
}

export function getBooks() {
  const raw = localStorage.getItem(BOOKS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBooks(books) {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  window.dispatchEvent(new CustomEvent("ptp:books-updated", { detail: books }));
}

export function evaluateBookCompletion(book) {
  const totalPages = Math.max(0, Number(book.totalPages) || 0);
  const rawCurrentPage = Math.max(0, Number(book.currentPage) || 0);
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];

  const allChaptersDone =
    chapters.length > 0 && chapters.every((ch) => Boolean(ch.completed));

  // If all chapters are checked and totalPages is 0, adopt rawCurrentPage if positive.
  const effectiveTotalPages =
    allChaptersDone && totalPages === 0 ? rawCurrentPage : totalPages;

  const lastPageReached =
    effectiveTotalPages > 0 && rawCurrentPage >= effectiveTotalPages;

  const isCompleted = allChaptersDone || lastPageReached;
  const clampedPage =
    lastPageReached && effectiveTotalPages > 0
      ? effectiveTotalPages
      : rawCurrentPage;

  return {
    ...book,
    totalPages: effectiveTotalPages,
    currentPage: clampedPage,
    completed: isCompleted,
    completedAt: isCompleted
      ? book.completedAt || new Date().toISOString()
      : null
  };
}

export function logBookPage(bookId, nextPageInput) {
  return updateBookEntry(bookId, (book) => {
    const enteredPage = Math.max(0, Number(nextPageInput) || 0);
    const currentTotal = Math.max(0, Number(book.totalPages) || 0);

    // If totalPages was 0 and user logs a positive page, set totalPages to enteredPage.
    // If enteredPage exceeds a known totalPages, raise totalPages to match.
    const nextTotalPages =
      currentTotal === 0 && enteredPage > 0
        ? enteredPage
        : currentTotal > 0 && enteredPage > currentTotal
          ? enteredPage
          : currentTotal;

    return {
      ...book,
      totalPages: nextTotalPages,
      currentPage: enteredPage
    };
  });
}

export function updateBookEntry(bookId, updaterFn) {
  const books = getBooks();
  let updatedItem = null;

  const nextBooks = books.map((book) => {
    if (book.id !== bookId) return book;
    const patched =
      typeof updaterFn === "function"
        ? updaterFn({ ...book })
        : { ...book, ...updaterFn };
    updatedItem = evaluateBookCompletion(patched);
    return updatedItem;
  });

  saveBooks(nextBooks);
  return updatedItem;
}

export function removeBookEntry(bookId) {
  const books = getBooks().filter((book) => book.id !== bookId);
  saveBooks(books);
}

export function getActiveReadingBooks() {
  return getBooks().filter((book) => !book.completed);
}

export function getFinishedReadingBooks() {
  return getBooks().filter((book) => Boolean(book.completed));
}

export function getReadingStats(defaultBookGoal = 20) {
  const allBooks = getBooks();
  const challenge = getChallengeStatus();
  const bookGoal = challenge?.bookGoal ?? defaultBookGoal;

  const finishedCount = allBooks.filter((b) => Boolean(b.completed)).length;
  const totalPagesRead = allBooks.reduce(
    (sum, b) => sum + Math.max(0, Number(b.currentPage) || 0),
    0
  );
  const remainingSlots = Math.max(0, bookGoal - allBooks.length);
  const daysLeft = challenge ? challenge.daysLeft : 0;

  return {
    finishedCount,
    bookGoal,
    totalPagesRead,
    remainingSlots,
    daysLeft
  };
}

function normalizeBookKey(book) {
  if (book.editionKey) return `ed:${String(book.editionKey).trim().toLowerCase()}`;
  if (book.workKey) return `wk:${String(book.workKey).trim().toLowerCase()}`;
  const title = String(book.title || "").trim().toLowerCase();
  const author = String(book.author || "").trim().toLowerCase();
  return `ta:${title}::${author}`;
}

export function isBookInStorage(candidate) {
  const targetKey = normalizeBookKey(candidate);
  const title = String(candidate.title || "").trim().toLowerCase();
  const author = String(candidate.author || "").trim().toLowerCase();

  return getBooks().some((existing) => {
    if (normalizeBookKey(existing) === targetKey) return true;
    const exTitle = String(existing.title || "").trim().toLowerCase();
    const exAuthor = String(existing.author || "").trim().toLowerCase();
    return Boolean(title) && exTitle === title && exAuthor === author;
  });
}

export function createBookEntry({
  title,
  author = "Unknown Author",
  totalPages = 0,
  currentPage = 0,
  chapters = [],
  coverUrl = null,
  workKey = null,
  editionKey = null
}) {
  const books = getBooks();
  const candidate = { title, author, workKey, editionKey };

  const existing =
    books.find((b) => normalizeBookKey(b) === normalizeBookKey(candidate)) ||
    books.find(
      (b) =>
        String(b.title || "").trim().toLowerCase() ===
          String(title || "").trim().toLowerCase() &&
        String(b.author || "").trim().toLowerCase() ===
          String(author || "").trim().toLowerCase()
    );

  if (existing) {
    return existing;
  }

  const normalizedChapters = (Array.isArray(chapters) ? chapters : []).map((ch, i) => ({
    id:
      ch.id ||
      `ch-${i + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: String(ch.title || `Chapter ${i + 1}`).trim(),
    completed: Boolean(ch.completed)
  }));

  const newBook = evaluateBookCompletion({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: String(title || "Untitled Book").trim(),
    author: String(author || "Unknown Author").trim(),
    totalPages: Math.max(0, Number(totalPages) || 0),
    currentPage: Math.max(0, Number(currentPage) || 0),
    chapters: normalizedChapters,
    coverUrl: coverUrl || null,
    workKey: workKey || null,
    editionKey: editionKey || null,
    createdAt: new Date().toISOString()
  });

  saveBooks([...books, newBook]);
  return newBook;
}

export function getCompletedBooks() {
  return getFinishedReadingBooks().sort((a, b) =>
    String(b.completedAt || "").localeCompare(String(a.completedAt || ""))
  );
}