// Node 25+ ships a built-in localStorage that is missing standard WebStorage
// methods, breaking next-themes / RainbowKit / wagmi during static generation.
// This polyfill is loaded with NODE_OPTIONS="--require ./polyfill-localstorage.cjs"
// so it runs in EVERY Node process the build spawns (including prerender workers).
// Per the frontend-playbook skill: only --require fixes this — instrumentation.ts
// and next.config polyfills do NOT run in the build worker.
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: key => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}
