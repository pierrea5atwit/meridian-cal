import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFeeds, getSpace, putSpace } from "./api";
import { addDays, endOfMonth, startOfMonth } from "./dates";
import type { CalendarSpace, FeedEvent, PersonalEvent } from "./types";

export interface MeridianState {
  space: CalendarSpace | null;
  feedEvents: FeedEvent[];
  feedErrors: { feed: string; message: string }[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  save: (mutate: (draft: CalendarSpace) => CalendarSpace) => Promise<void>;
  upsertEvent: (ev: PersonalEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  reloadFeeds: () => void;
}

/** Month-bucket key so we only re-fetch feeds when the visible month changes. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function useMeridian(spaceId: string, anchor: Date): MeridianState {
  const [space, setSpace] = useState<CalendarSpace | null>(null);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [feedErrors, setFeedErrors] = useState<{ feed: string; message: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedNonce, setFeedNonce] = useState(0);

  const mKey = monthKey(anchor);

  // Load the space whenever the id changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getSpace(spaceId)
      .then((s) => alive && setSpace(s))
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [spaceId]);

  // Fetch feed occurrences for a padded window around the visible month.
  const feedCount = space?.feeds.filter((f) => f.enabled).length ?? 0;
  useEffect(() => {
    if (!space) return;
    if (feedCount === 0) {
      setFeedEvents([]);
      setFeedErrors([]);
      return;
    }
    let alive = true;
    setRefreshing(true);
    const from = addDays(startOfMonth(anchor), -7);
    const to = addDays(endOfMonth(anchor), 7);
    getFeeds(spaceId, from, to)
      .then((r) => {
        if (!alive) return;
        setFeedEvents(r.events);
        setFeedErrors(r.errors);
      })
      .catch((e) => alive && setFeedErrors([{ feed: "all", message: String(e) }]))
      .finally(() => alive && setRefreshing(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, mKey, feedCount, feedNonce]);

  // Serialize writes so concurrent edits don't clobber each other.
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());

  const save = useCallback(
    (mutate: (draft: CalendarSpace) => CalendarSpace) => {
      const run = writeChain.current.then(async () => {
        const base =
          space ?? { feeds: [], events: [], categories: [], updatedAt: 0 };
        const next = mutate(structuredClone(base));
        setSpace(next); // optimistic
        try {
          const saved = await putSpace(spaceId, next);
          setSpace(saved);
        } catch (e) {
          setError(String(e));
          // reload authoritative state on failure
          try {
            setSpace(await getSpace(spaceId));
          } catch {
            /* keep optimistic copy */
          }
        }
      });
      writeChain.current = run.catch(() => {});
      return run;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [spaceId, space],
  );

  const upsertEvent = useCallback(
    (ev: PersonalEvent) =>
      save((draft) => {
        const i = draft.events.findIndex((e) => e.id === ev.id);
        if (i >= 0) draft.events[i] = ev;
        else draft.events.push(ev);
        return draft;
      }),
    [save],
  );

  const deleteEvent = useCallback(
    (id: string) =>
      save((draft) => {
        draft.events = draft.events.filter((e) => e.id !== id);
        return draft;
      }),
    [save],
  );

  const reloadFeeds = useCallback(() => setFeedNonce((n) => n + 1), []);

  return useMemo(
    () => ({
      space,
      feedEvents,
      feedErrors,
      loading,
      refreshing,
      error,
      save,
      upsertEvent,
      deleteEvent,
      reloadFeeds,
    }),
    [space, feedEvents, feedErrors, loading, refreshing, error, save, upsertEvent, deleteEvent, reloadFeeds],
  );
}
