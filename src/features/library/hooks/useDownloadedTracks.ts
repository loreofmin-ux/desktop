import { useCallback, useEffect, useState } from "react";
import { linerDb, type CachedTrackRecord } from "@/shared/storage";
import type { Track } from "@/shared/types";

export const DOWNLOADS_PLAYLIST_ID = "downloads";

export function cachedRecordToTrack(record: CachedTrackRecord): Track {
  return {
    id: record.id,
    title: record.title,
    artists: record.artists,
    coverUrl: record.coverUrl ?? "",
    durationMs: record.durationMs ?? 0,
    playCount: 0,
    album:
      record.albumId && record.albumTitle
        ? { id: record.albumId, title: record.albumTitle }
        : undefined,
  };
}

export async function loadDownloadedTracks(): Promise<Track[]> {
  try {
    const records = await linerDb.getDownloadedTracks();
    return records.map(cachedRecordToTrack);
  } catch {
    return [];
  }
}

// tracks whose audio is already on disk, playable without the server
export function useDownloadedTracks(enabled: boolean = true) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const next = await loadDownloadedTracks();
    setTracks(next);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setTracks(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    void loadDownloadedTracks().then((next) => {
      if (!active) return;
      setTracks(next);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  // the page is not remounted between playlist ids, so cover the render before the effect runs
  return { data: tracks, isLoading: enabled && (isLoading || tracks === null), refresh };
}
