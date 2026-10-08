import type { Comment, HistoryItem } from "./types";

const FAVORITES_KEY = "comment-favorites";
const HISTORY_KEY = "comment-history";
const MAX_HISTORY = 20;

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Guest-mode persistence is best effort.
  }
}

export function getFavorites(): Record<string, Comment> {
  return read<Record<string, Comment>>(FAVORITES_KEY, {});
}

export function saveFavorite(comment: Comment) {
  const favorites = getFavorites();
  favorites[comment.id] = { ...comment, is_favorite: true };
  write(FAVORITES_KEY, favorites);
}

export function removeFavorite(id: string) {
  const favorites = getFavorites();
  delete favorites[id];
  write(FAVORITES_KEY, favorites);
}

export function getHistory(): HistoryItem[] {
  return read<HistoryItem[]>(HISTORY_KEY, []);
}

export function addHistory(item: HistoryItem) {
  const history = [item, ...getHistory().filter(existing => existing.id !== item.id)].slice(0, MAX_HISTORY);
  write(HISTORY_KEY, history);
}
