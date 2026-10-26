import { afterAll, describe, expect, it, vi } from "vitest";
import { solveN } from "./n-solver";

vi.mock("electron", () => ({
  contextBridge: {
    // rebuilds the function from its source, like the hop into the main world
    executeInMainWorld: ({
      func,
      args,
    }: {
      func: () => unknown;
      args: unknown[];
    }) => new Function(`return ${func}`)()(...args),
  },
}));

const table = ["set", "get", "alr", "yes", "n", "other"].join("}");
const player = `var _yt_player={};(function(g){var w='${table}'.split('}');
  var U=function(b){this.p=new URL(b).searchParams};
  U.prototype.set=function(k,v){this.p.set(k,v)};
  U.prototype.get=function(k){return this.p.get(k)};
  U.prototype.Xs=function(){this.p.set(w[4],this.p.get(w[4]).split("").reverse().join(""))};
  var Pk=function(q,y,b){var h=y^q;if(h){var u=new U(b);u[w[h^7]](w[h^5],w[h^4]);return u}return null};
  Pk(10,13,"https://example.com");var cfg={signatureTimestamp:20385};
})(_yt_player);`;

function stubFetch() {
  const fetch = vi.fn(async () => ({ ok: true, text: async () => player }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("solveN", () => {
  afterAll(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "__linerUrlFactory_test_1");
    Reflect.deleteProperty(globalThis, "__linerUrlFactory_test_2");
  });

  it("runs the player in the main world and caches it per player id", async () => {
    const fetch = stubFetch();
    await expect(solveN("test-1", ["abc", "xyz"])).resolves.toEqual({
      signatureTimestamp: 20385,
      values: ["cba", "zyx"],
    });
    await expect(solveN("test-1", ["liner"])).resolves.toEqual({
      signatureTimestamp: 20385,
      values: ["renil"],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects n values the player left unchanged", async () => {
    stubFetch();
    await expect(solveN("test-2", ["aba"])).rejects.toThrow(
      "YouTube TV player returned an invalid n value",
    );
  });
});
