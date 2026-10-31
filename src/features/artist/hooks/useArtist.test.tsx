// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useArtist } from "./useArtist";
import { api } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/api", () => ({
  api: { getArtist: vi.fn(), search: vi.fn() },
  mediaUrl: (url: string) => url,
  toMaxQualityAvatarUrl: (url: string) => url,
  toClientTrack: (track: { id: string }) => ({ ...track }),
}));

const artist = {
  name: "Boards of Canada",
  verified: true,
  bio: "",
  cover: { url: "boc.jpg" },
  tracks: [],
  albums: [],
  singles: [],
};

let firstRender: ReturnType<typeof useArtist> | null = null;
let latest: ReturnType<typeof useArtist> | null = null;

function Probe({ id }: { id: string }) {
  const state = useArtist(id);
  firstRender ??= state;
  latest = state;
  return null;
}

describe("useArtist", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    queryCache.clear();
    firstRender = null;
    latest = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(api.getArtist).mockReset();
    vi.mocked(api.getArtist).mockResolvedValue(artist as any);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("opens an artist seen before from memory on the first render", async () => {
    await act(async () => {
      root.render(<Probe id="boc" />);
    });
    expect(latest?.data?.title).toBe("Boards of Canada");
    expect(api.getArtist).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    root = createRoot(container);
    firstRender = null;
    vi.mocked(api.getArtist).mockReturnValue(new Promise(() => undefined));

    act(() => {
      root.render(<Probe id="boc" />);
    });
    expect(firstRender).toMatchObject({
      loading: false,
      data: { title: "Boards of Canada" },
    });
    expect(api.getArtist).toHaveBeenCalledTimes(1);
  });

  it("opens a share link that carries the artist's name instead of an id", async () => {
    const channel = "UC0123456789abcdefghijKL";
    vi.mocked(api.getArtist).mockImplementation(async (id: string) => {
      if (id !== channel) throw new Error("not found");
      return { ...artist, id: channel, name: "Latin Mafia" } as any;
    });
    vi.mocked(api.search).mockResolvedValue({
      items: [
        {
          type: "artist",
          id: "UCzzzzzzzzzzzzzzzzzzzzzz",
          name: "Latin Mafia Tribute",
        },
        { type: "artist", id: channel, name: "Latin Mafia" },
      ],
    } as any);

    await act(async () => {
      root.render(<Probe id="LATIN MAFIA" />);
    });

    expect(api.search).toHaveBeenCalledWith("LATIN MAFIA", "artist");
    expect(latest?.data).toMatchObject({ id: channel, title: "Latin Mafia" });
  });

  it("does not guess an artist when no name matches exactly", async () => {
    vi.mocked(api.getArtist).mockRejectedValue(new Error("not found"));
    vi.mocked(api.search).mockResolvedValue({
      items: [
        {
          type: "artist",
          id: "UCzzzzzzzzzzzzzzzzzzzzzz",
          name: "Someone Else",
        },
      ],
    } as any);

    await act(async () => {
      root.render(<Probe id="Nobody" />);
    });

    expect(latest).toMatchObject({ data: null, loading: false });
    expect(api.getArtist).toHaveBeenCalledTimes(1);
  });
});
