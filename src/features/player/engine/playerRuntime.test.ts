import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ resolvePlaybackStream: vi.fn() }));

vi.mock("./streamResolver", () => ({ resolvePlaybackStream: mocks.resolvePlaybackStream }));

import { playerRuntime, PlayerRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";
import { linerDb } from "@/shared/storage";
import { setAuthSession } from "@/shared/api/auth-session";
import type { Track } from "@/shared/types";

const urlStream = {
  url: "https://rr1.googlevideo.com/videoplayback?itag=251",
  mimeType: "audio/webm",
  codec: "opus",
  bitrate: 128000,
  expiresAtMs: null,
};

const track: Track = {
  id: "t1",
  title: "Track",
  artists: "Artist",
  durationMs: 100_000,
  coverUrl: "",
  playCount: 0,
};

function setAudioPaused(value: boolean) {
  Object.defineProperty((playerRuntime as any).audio, "paused", {
    value,
    configurable: true,
  });
}

describe("PlayerRuntime — status must always match the real audio state", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      status: "idle",
      currentTrack: track,
      queue: [track],
      currentIndex: 0,
      positionMs: 0,
      durationMs: track.durationMs,
      volume: 1,
      error: null,
    });
    (playerRuntime as any).audio.src = "blob:mock-stream";
    setAudioPaused(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a stale resume() play-promise settling after a newer pause() must not restart the fade/playback sequence", async () => {
    const originalFadeVolume = (PlayerRuntime.prototype as any).fadeVolume;
    const fadeSpy = vi
      .spyOn(PlayerRuntime.prototype as any, "fadeVolume")
      .mockImplementation(function (this: unknown, ...args: unknown[]) {
        return originalFadeVolume.apply(this, args);
      });

    let resolvePlay: () => void;
    const pendingPlay = new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValue(pendingPlay as unknown as Promise<void>);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    playerRuntime!.resume();
    expect(usePlayerStore.getState().status).toBe("playing");
    expect(fadeSpy).not.toHaveBeenCalled();

    playerRuntime!.pause();
    expect(usePlayerStore.getState().status).toBe("paused");
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(fadeSpy).toHaveBeenCalledTimes(1);

    resolvePlay!();
    await pendingPlay;
    await Promise.resolve();
    await Promise.resolve();

    expect(fadeSpy).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe("paused");
  });

  it("a stale resume() play-promise rejecting after a newer pause() must not touch status either", async () => {
    let rejectPlay: (err: unknown) => void;
    const pendingPlay = new Promise<void>((_resolve, reject) => {
      rejectPlay = reject;
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValue(pendingPlay as unknown as Promise<void>);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    playerRuntime!.resume();
    playerRuntime!.pause();
    expect(usePlayerStore.getState().status).toBe("paused");

    rejectPlay!(new DOMException("aborted", "AbortError"));
    await pendingPlay.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();

    expect(usePlayerStore.getState().status).toBe("paused");
  });
});

describe("PlayerRuntime audio caching", () => {
  beforeEach(() => {
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn((_blob: Blob) => "blob:mock-object-url");
    } else {
      vi.spyOn(globalThis.URL, "createObjectURL").mockReturnValue("blob:mock-object-url");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, "revokeObjectURL").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mocks.resolvePlaybackStream.mockReset();
  });

  it("plays directly from linerDb cache when audio blob exists without resolving a stream", async () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const sessionSpy = mocks.resolvePlaybackStream;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const mockBlob = new Blob(["fake-opus-data"], { type: "audio/webm" });
    await linerDb.putAudio("cached-track-1", mockBlob, "audio/webm");

    const cachedTrack: Track = {
      ...track,
      id: "cached-track-1",
      title: "Cached Track",
    };

    await playerRuntime!.loadAndPlay(cachedTrack);

    expect(sessionSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe("playing");
  });

  it("fetches, plays, and saves to linerDb on cache miss", async () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const sessionSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]), {
        status: 206,
        headers: { "content-type": "audio/webm" },
      }),
    );

    const freshTrack: Track = {
      ...track,
      id: "fresh-track-2",
      title: "Fresh Track",
    };

    await playerRuntime!.loadAndPlay(freshTrack);

    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalled();

    await vi.waitFor(async () => {
      const storedAudio = await linerDb.getAudio("fresh-track-2");
      expect(storedAudio?.byteSize).toBe(16);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("preloads audio in the background and enables instant cache-hit play on skip", async () => {
    const sessionSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0]), {
        status: 206,
        headers: { "content-type": "audio/webm" },
      }),
    );

    const nextTrack: Track = {
      ...track,
      id: "next-track-3",
      title: "Next Track",
    };

    await playerRuntime!.preloadTrack(nextTrack);

    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const storedAudio = await linerDb.getAudio("next-track-3");
    expect(storedAudio).not.toBeNull();
    expect(storedAudio?.byteSize).toBe(16);

    sessionSpy.mockClear();
    fetchSpy.mockClear();

    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    await playerRuntime!.loadAndPlay(nextTrack);

    expect(sessionSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe("playing");
  });

  it("evicts corrupt 0-byte audio blob from cache and fetches fresh stream", async () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const sessionSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]), {
        status: 200,
        headers: { "content-type": "audio/webm" },
      }),
    );

    const emptyBlob = new Blob([], { type: "audio/webm" });
    await linerDb.putAudio("corrupt-track-4", emptyBlob, "audio/webm");

    const corruptTrack: Track = {
      ...track,
      id: "corrupt-track-4",
      title: "Corrupt Track",
    };

    await playerRuntime!.loadAndPlay(corruptTrack);

    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe("playing");

    const cachedAfter = await linerDb.getAudio("corrupt-track-4");
    expect(cachedAfter?.byteSize).not.toBe(0);
  });

  it("does not cache partial stream chunks when content-range exceeds downloaded bytes", async () => {
    mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 206,
        headers: {
          "content-type": "audio/webm",
          "content-range": "bytes 0-3/1000000",
        },
      }),
    );

    const partialTrack: Track = {
      ...track,
      id: "partial-track-5",
      title: "Partial Track",
    };

    await playerRuntime!.preloadTrack(partialTrack);

    const stored = await linerDb.getAudio("partial-track-5");
    expect(stored).toBeNull();
  });

  it("drops an unreadable cached file, recovers from the network once and does not cache a dash segment", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const resolveSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(new Uint8Array([0, 0, 0, 0x18, 0x73, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0]), { status: 206 }),
    );

    const corruptTrack: Track = { ...track, id: "corrupt-track", title: "Corrupt" };
    await linerDb.putAudio(corruptTrack.id, new Blob([new Uint8Array([9, 9, 9])], { type: "audio/webm" }), "audio/webm");
    usePlayerStore.setState({ currentTrack: corruptTrack, positionMs: 0 });
    await playerRuntime!.loadAndPlay(corruptTrack);
    expect(resolveSpy).not.toHaveBeenCalled();

    const audio = (playerRuntime as unknown as { audio: HTMLAudioElement }).audio;
    Object.defineProperty(audio, "error", { value: { code: 4, message: "DEMUXER_ERROR_COULD_NOT_OPEN" }, configurable: true });
    try {
      audio.dispatchEvent(new Event("error"));
      await vi.waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(usePlayerStore.getState().status).toBe("playing"), { timeout: 5000 });
      expect(await linerDb.getAudio(corruptTrack.id)).toBeNull();

      audio.dispatchEvent(new Event("error"));
      await vi.waitFor(() => expect(usePlayerStore.getState().status).toBe("error"));
      expect(resolveSpy).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(audio, "error");
    }
  }, 15_000);

  it("restores the recovery attempt after steady playback so a later transient error recovers again", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const resolveSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    // not a standalone file, so nothing is cached and every load goes to the network
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(new Uint8Array(16), { status: 206 }));

    const longTrack: Track = { ...track, id: "long-track", title: "Long" };
    usePlayerStore.setState({ currentTrack: longTrack, positionMs: 0 });

    const audio = (playerRuntime as any).audio as HTMLAudioElement;
    let mediaTime = 0;
    Object.defineProperty(audio, "readyState", { get: () => 4, configurable: true });
    Object.defineProperty(audio, "currentTime", { get: () => mediaTime, set: () => {}, configurable: true });
    Object.defineProperty(audio, "error", { value: { code: 2, message: "network error" }, configurable: true });
    const playFor = (seconds: number) => {
      audio.dispatchEvent(new Event("playing"));
      for (let elapsed = 0; elapsed < seconds; elapsed += 0.25) {
        mediaTime += 0.25;
        audio.dispatchEvent(new Event("timeupdate"));
      }
    };

    try {
      await playerRuntime!.loadAndPlay(longTrack);
      expect(resolveSpy).toHaveBeenCalledTimes(1);

      audio.dispatchEvent(new Event("error"));
      await vi.waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(usePlayerStore.getState().status).toBe("playing"));

      // steady playback after the recovery: a later error (expired session) recovers again
      playFor(6);
      audio.dispatchEvent(new Event("error"));
      await vi.waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(3));
      await vi.waitFor(() => expect(usePlayerStore.getState().status).toBe("playing"));

      // a short playback is not enough, the next error gives up
      playFor(1);
      audio.dispatchEvent(new Event("error"));
      await vi.waitFor(() => expect(usePlayerStore.getState().status).toBe("error"));
      expect(resolveSpy).toHaveBeenCalledTimes(3);
    } finally {
      Reflect.deleteProperty(audio, "readyState");
      Reflect.deleteProperty(audio, "currentTime");
      Reflect.deleteProperty(audio, "error");
    }
  });
});

describe("PlayerRuntime cache ownership for the offline downloads list", () => {
  const signIn = (id: string) =>
    setAuthSession({
      accessToken: "a",
      refreshToken: "r",
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id },
    });
  const webm = () =>
    new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]), {
      status: 206,
      headers: { "content-type": "audio/webm" },
    });

  beforeEach(async () => {
    await linerDb.clearAll();
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn((_blob: Blob) => "blob:mock-object-url");
    } else {
      vi.spyOn(globalThis.URL, "createObjectURL").mockReturnValue("blob:mock-object-url");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, "revokeObjectURL").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    setAuthSession(null);
    vi.restoreAllMocks();
    mocks.resolvePlaybackStream.mockReset();
  });

  it("tags a file cached during playback with the account that played it", async () => {
    signIn("user-a");
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => webm());
    const owned: Track = { ...track, id: "own-1", title: "Owned" };

    await playerRuntime!.loadAndPlay(owned);
    (playerRuntime as any).audio.dispatchEvent(new Event("playing"));

    await vi.waitFor(async () => {
      expect((await linerDb.getAudio("own-1"))?.ownerIds).toEqual(["user-a"]);
    });
    expect((await linerDb.getDownloadedTracks("user-a")).map((t) => t.id)).toEqual(["own-1"]);
    expect(await linerDb.getDownloadedTracks("user-b")).toEqual([]);
  });

  it("tags a preloaded file with the signed-in account", async () => {
    signIn("user-a");
    mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => webm());

    await playerRuntime!.preloadTrack({ ...track, id: "pre-1", title: "Preloaded" });

    expect((await linerDb.getAudio("pre-1"))?.ownerIds).toEqual(["user-a"]);
  });

  it("adds a second account when it plays a file another account cached", async () => {
    await linerDb.putAudio("shared-1", new Blob(["x"], { type: "audio/webm" }), "audio/webm", undefined, "user-a");
    signIn("user-b");
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();

    await playerRuntime!.loadAndPlay({ ...track, id: "shared-1", title: "Shared" });

    await vi.waitFor(async () => {
      expect((await linerDb.getAudio("shared-1"))?.ownerIds).toEqual(["user-a", "user-b"]);
    });
  });

  it("keeps the owner that started the background download when the account switches mid-download", async () => {
    signIn("user-a");
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await gate;
      return webm();
    });

    await playerRuntime!.loadAndPlay({ ...track, id: "switch-1", title: "Switch" });
    (playerRuntime as any).audio.dispatchEvent(new Event("playing"));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    setAuthSession(null);
    signIn("user-b");
    release();

    await vi.waitFor(async () => {
      expect((await linerDb.getAudio("switch-1"))?.ownerIds).toEqual(["user-a"]);
    });
  });

  it("keeps the owner that started a preload when the account signs out mid-download", async () => {
    signIn("user-a");
    mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await gate;
      return webm();
    });

    const pending = playerRuntime!.preloadTrack({ ...track, id: "switch-2", title: "Switch preload" });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    setAuthSession(null);
    signIn("user-b");
    release();
    await pending;

    expect((await linerDb.getAudio("switch-2"))?.ownerIds).toEqual(["user-a"]);
  });

  it("caches without an owner when nobody is signed in", async () => {
    mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => webm());

    await playerRuntime!.preloadTrack({ ...track, id: "anon-1", title: "Anonymous" });

    const record = await linerDb.getAudio("anon-1");
    expect(record).not.toBeNull();
    expect(record?.ownerIds).toBeUndefined();
  });
});
