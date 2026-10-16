export type LyricsFormat = 'plain' | 'lrc' | 'ttml' | 'qrc' | 'richsync';

export type LyricsContentKind = 'plain' | 'line_synced' | 'word_synced' | 'syllable_synced';

export type LyricsSyncLevel = 'plain' | 'line_level' | 'word_level' | 'syllable_level';

export interface RawLyricsCandidate {
  matchedTrack?: {
    title?: string;
    artists?: string[];
    durationMs?: number;
  };
  lyrics: {
    format: LyricsFormat;
    content: string;
  };
  syncHint?: LyricsContentKind;
}

export interface LyricsQuality {
  total: number;
  match: number;
  content: number;
  sync: number;
  source: number;
  reasons: string[];
}

export interface LyricsCandidate extends RawLyricsCandidate {
  provider: string;
  contentKind: LyricsContentKind;
  syncLevel: LyricsSyncLevel;
  topPriority?: boolean;
  quality: LyricsQuality;
}

export type LyricsStreamEvent =
  | {
      type: 'metadata';
      track: {
        id: string;
        title: string;
        artists: { id: string; name: string }[];
        durationMs: number;
      };
    }
  | {
      type: 'provider';
      provider: string;
      status: 'found';
      syncLevel: LyricsSyncLevel;
      candidate: LyricsCandidate;
      durationMs?: number;
    }
  | {
      type: 'provider';
      provider: string;
      status: 'not_found';
      durationMs?: number;
    }
  | {
      type: 'provider';
      provider: string;
      status: 'error';
      message: string;
      durationMs?: number;
    }
  | {
      type: 'done';
      cached: boolean;
      best?: {
        provider: string;
        quality: number;
        syncLevel: LyricsSyncLevel;
      };
      status?: 'not_found';
    };

// body of POST /v1/tracks/{id}/lyrics/reports, proposed for the backend
export interface LyricsReportRequest {
  reportId: string;
  kind: 'wrong_words' | 'out_of_sync';
  createdAt: string;
  positionMs: number;
  offsetMs: number;
  note?: string;
  line: {
    index: number;
    text: string;
    startMs: number | null;
    endMs: number | null;
    picked: 'clicked' | 'active';
  } | null;
  context: {
    before: string[];
    after: string[];
  };
  lyrics: {
    provider: string | null;
    format: string | null;
    syncLevel: string | null;
    contentHash: string | null;
    lineCount: number;
  };
  client: {
    appVersion: string;
    locale: string;
  };
}
