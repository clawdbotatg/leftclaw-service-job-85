/**
 * criteria.ts — 47 hex-pattern based "criteria" functions for Clawd & Effect.
 *
 * Each criterion takes the lowercased holder list (with the connected sender
 * address always lowercased too) and returns the winning address.
 *
 * Tie-breaking: when multiple holders are tied for the "best" score, pick one
 * uniformly at random with Math.random(). When no holder qualifies (pattern
 * not present), pick a random fallback so the UI always reveals something.
 *
 * Address shape: lowercased "0x" + 40 hex chars. We work on the 40-char body
 * for substring/character logic; we work on a BigInt for math criteria.
 */

export type Criterion = {
  id: number;
  name: string;
  description: string;
  evaluate: (holders: string[], senderAddress: string) => string;
};

// ---------- helpers ----------

const HEX = "0123456789abcdef";

const body = (addr: string) => addr.replace(/^0x/, "").toLowerCase();

const isDigit = (c: string) => c >= "0" && c <= "9";
const isLetter = (c: string) => c >= "a" && c <= "f";
const hexVal = (c: string) => parseInt(c, 16);

const countSubstr = (s: string, pat: string): number => {
  if (!pat.length) return 0;
  let n = 0;
  let i = 0;
  while ((i = s.indexOf(pat, i)) !== -1) {
    n++;
    i++; // overlapping count (not strictly needed for these patterns)
  }
  return n;
};

const countChar = (s: string, ch: string): number => {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
};

const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const argmax = <T>(arr: T[], score: (x: T) => number): { winners: T[]; max: number } => {
  let max = -Infinity;
  let winners: T[] = [];
  for (const x of arr) {
    const s = score(x);
    if (s > max) {
      max = s;
      winners = [x];
    } else if (s === max) {
      winners.push(x);
    }
  }
  return { winners, max };
};

const pickByMax = (
  holders: string[],
  score: (h: string) => number,
  // If no holder strictly qualifies (max === 0 with patterns), still return random.
  options: { fallbackOnZero?: boolean } = {},
): string => {
  if (holders.length === 0) throw new Error("no holders");
  const { winners, max } = argmax(holders, score);
  if (options.fallbackOnZero && max === 0) return randomChoice(holders);
  return randomChoice(winners);
};

const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
};

const isSquareInt = (n: number): boolean => {
  if (n < 0) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
};

const isPalindromeNum = (n: number): boolean => {
  const s = String(n);
  return s === s.split("").reverse().join("");
};

const sumHexDigits = (b: string): number => {
  let s = 0;
  for (const c of b) s += hexVal(c);
  return s;
};

const addrToBigInt = (addr: string): bigint => BigInt(addr);

const bigAbsDiff = (a: bigint, b: bigint): bigint => (a > b ? a - b : b - a);

// ---------- criteria 20-34 helpers ----------

// Longest run of the same character.
const longestSameRun = (b: string): number => {
  if (!b) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < b.length; i++) {
    if (b[i] === b[i - 1]) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
};

// Longest strictly ascending hex-value run.
const longestAscRun = (b: string): number => {
  let best = 1;
  let cur = 1;
  for (let i = 1; i < b.length; i++) {
    if (hexVal(b[i]) > hexVal(b[i - 1])) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
};

const longestDescRun = (b: string): number => {
  let best = 1;
  let cur = 1;
  for (let i = 1; i < b.length; i++) {
    if (hexVal(b[i]) < hexVal(b[i - 1])) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
};

const longestDecimalRun = (b: string): number => {
  let best = 0;
  let cur = 0;
  for (const c of b) {
    if (isDigit(c)) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
};

// Non-overlapping consecutive identical pairs ("aabb" => 2; "aaaa" => 2).
const stutterPairs = (b: string): number => {
  let n = 0;
  let i = 0;
  while (i + 1 < b.length) {
    if (b[i] === b[i + 1]) {
      n++;
      i += 2;
    } else {
      i++;
    }
  }
  return n;
};

// Longest unbroken run of chars from a set.
const longestRunFromSet = (b: string, set: Set<string>): number => {
  let best = 0;
  let cur = 0;
  for (const c of b) {
    if (set.has(c)) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
};

// Sandwich: count <X><Y><X> with hexVal(Y) < hexVal(X). Overlapping allowed
// (advance by 1) — documented choice: more sensitive to "valleys".
const sandwichCount = (b: string): number => {
  let n = 0;
  for (let i = 0; i + 2 < b.length; i++) {
    if (b[i] === b[i + 2] && hexVal(b[i + 1]) < hexVal(b[i])) n++;
  }
  return n;
};

// "ZagAddress": longest run where two characters strictly alternate and the
// run has length >= 4. We score: max length found of any alternating pair
// pattern with two distinct chars (so XYXYXY counts but XXXX does not).
const zagBestLen = (b: string): number => {
  if (b.length < 4) return 0;
  let best = 0;
  let i = 0;
  while (i < b.length - 1) {
    const a = b[i];
    const c = b[i + 1];
    if (a === c) {
      i++;
      continue;
    }
    let j = i + 2;
    while (j < b.length && b[j] === (j % 2 === i % 2 ? a : c)) j++;
    const len = j - i;
    if (len >= 4 && len > best) best = len;
    // Advance by 1 so we don't miss overlapping starts on different pairs
    i++;
  }
  return best;
};

// XOR of N hex digits (4-bit each), returned as a single 0-15 int.
const xorHexDigits = (b: string): number => {
  let v = 0;
  for (const c of b) v ^= hexVal(c);
  return v;
};

// XOR of all 20 BYTES of the address — for the "Total Chaos" criterion (47).
const xorAddressBytes = (b: string): number => {
  let v = 0;
  for (let i = 0; i < b.length; i += 2) {
    v ^= parseInt(b.slice(i, i + 2), 16);
  }
  return v & 0xff;
};

// Every distinct character in b appears an even number of times.
const allEvenCounts = (b: string): boolean => {
  const counts: Record<string, number> = {};
  for (const c of b) counts[c] = (counts[c] || 0) + 1;
  return Object.values(counts).every(n => n % 2 === 0);
};

// ---------- criteria definitions ----------

const CLAWD_TOKEN_BIG = BigInt("0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07".toLowerCase());

export const criteria: Criterion[] = [
  // 1-19: substring / character counting
  {
    id: 1,
    name: "Nice",
    description: 'Most "69"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "69"), { fallbackOnZero: true }),
  },
  {
    id: 2,
    name: "Blaze It",
    description: 'Most "420"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "420"), { fallbackOnZero: true }),
  },
  {
    id: 3,
    name: "Most Ethereum",
    description: 'Most letter "e"s — like the protocol they live on.',
    evaluate: holders => pickByMax(holders, h => countChar(body(h), "e")),
  },
  {
    id: 4,
    name: "Lucky",
    description: 'Most "7"s in their address.',
    evaluate: holders => pickByMax(holders, h => countChar(body(h), "7")),
  },
  {
    id: 5,
    name: "Si",
    description: 'Most "4"s — yes for everything.',
    evaluate: holders => pickByMax(holders, h => countChar(body(h), "4")),
  },
  {
    id: 6,
    name: "I Give Up",
    description: 'Most "f"s — couldn\'t be bothered.',
    evaluate: holders => pickByMax(holders, h => countChar(body(h), "f")),
  },
  {
    id: 7,
    name: "The Nihilist",
    description: "Most zeros — believes in nothing.",
    evaluate: holders => pickByMax(holders, h => countChar(body(h), "0")),
  },
  {
    id: 8,
    name: "CLAWD Score",
    description: 'Most "c", "a", and "d" letters combined.',
    evaluate: holders =>
      pickByMax(holders, h => {
        const b = body(h);
        return countChar(b, "c") + countChar(b, "a") + countChar(b, "d");
      }),
  },
  {
    id: 9,
    name: "Timeless",
    description: 'Most "b00b"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "b00b"), { fallbackOnZero: true }),
  },
  {
    id: 10,
    name: "Needs Caffeine",
    description: 'Most "cafe"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "cafe"), { fallbackOnZero: true }),
  },
  {
    id: 11,
    name: "Ships Code",
    description: 'Most "c0de"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "c0de"), { fallbackOnZero: true }),
  },
  {
    id: 12,
    name: "Hangry",
    description: 'Most "f00d"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "f00d"), { fallbackOnZero: true }),
  },
  {
    id: 13,
    name: "Big b055 Energy",
    description: 'Most "b055"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "b055"), { fallbackOnZero: true }),
  },
  {
    id: 14,
    name: "Much Wallet",
    description: 'Most "d0ge"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "d0ge"), { fallbackOnZero: true }),
  },
  {
    id: 15,
    name: "Not Found",
    description: 'Most "404"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "404"), { fallbackOnZero: true }),
  },
  {
    id: 16,
    name: "The Beast",
    description: 'Most "666"s in their address.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "666"), { fallbackOnZero: true }),
  },
  {
    id: 17,
    name: "Dead and Fed",
    description: 'Most "dead" plus "beef" combined.',
    evaluate: holders =>
      pickByMax(holders, h => countSubstr(body(h), "dead") + countSubstr(body(h), "beef"), { fallbackOnZero: true }),
  },
  {
    id: 18,
    name: "Turtles All the Way Down",
    description: 'Most occurrences of "0x" inside the address body itself.',
    evaluate: holders => pickByMax(holders, h => countSubstr(body(h), "0x"), { fallbackOnZero: true }),
  },
  {
    id: 19,
    name: "Leet Claw",
    description: 'Address contains "c1aw" or "c14w".',
    evaluate: holders => {
      const matches = holders.filter(h => {
        const b = body(h);
        return b.includes("c1aw") || b.includes("c14w");
      });
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },

  // 20-34: string patterns
  {
    id: 20,
    name: "The Broken Record",
    description: "Longest run of the same character repeated.",
    evaluate: holders => pickByMax(holders, h => longestSameRun(body(h))),
  },
  {
    id: 21,
    name: "The Climber",
    description: "Longest strictly ascending hex run (e.g. 1234, abcdef).",
    evaluate: holders => pickByMax(holders, h => longestAscRun(body(h))),
  },
  {
    id: 22,
    name: "The Doomer",
    description: "Longest strictly descending hex run.",
    evaluate: holders => pickByMax(holders, h => longestDescRun(body(h))),
  },
  {
    id: 23,
    name: "Please Leave a Message",
    description: "Longest run of consecutive decimal-only chars (0-9).",
    evaluate: holders => pickByMax(holders, h => longestDecimalRun(body(h))),
  },
  {
    id: 24,
    name: "The Stutterer",
    description: "Most consecutive identical pairs (e.g. aabb).",
    evaluate: holders => pickByMax(holders, h => stutterPairs(body(h)), { fallbackOnZero: true }),
  },
  {
    id: 25,
    name: "The Ouroboros Wallet",
    description: "First body char equals last body char.",
    evaluate: holders => {
      const matches = holders.filter(h => {
        const b = body(h);
        return b[0] === b[b.length - 1];
      });
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 26,
    name: "The Original Mascot",
    description: "Longest unbroken run of chars from {a,c,d}.",
    evaluate: holders => pickByMax(holders, h => longestRunFromSet(body(h), new Set(["a", "c", "d"]))),
  },
  {
    id: 27,
    name: "Perfectly Balanced",
    description: "Exactly 20 digits and 20 letters in the body.",
    evaluate: holders => {
      const matches = holders.filter(h => {
        const b = body(h);
        let d = 0;
        for (const c of b) if (isDigit(c)) d++;
        return d === 20;
      });
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 28,
    name: "The ADD Address",
    description: "No two adjacent body chars that are both equal digits.",
    evaluate: holders => {
      const matches = holders.filter(h => {
        const b = body(h);
        for (let i = 1; i < b.length; i++) {
          if (isDigit(b[i]) && isDigit(b[i - 1]) && b[i] === b[i - 1]) return false;
        }
        return true;
      });
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 29,
    name: "Faces Both Ways",
    description: "First 20 body chars equal the reverse of the last 20.",
    evaluate: holders => {
      const matches = holders.filter(h => {
        const b = body(h);
        const first = b.slice(0, 20);
        const last = b.slice(20, 40);
        return first === last.split("").reverse().join("");
      });
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 30,
    name: "Bilateral Symmetry",
    description: "Most occurrences of visually-symmetric chars 0, 1, 8.",
    evaluate: holders =>
      pickByMax(holders, h => {
        const b = body(h);
        return countChar(b, "0") + countChar(b, "1") + countChar(b, "8");
      }),
  },
  {
    id: 31,
    name: "Perfectly Unhinged",
    description: "Every distinct character appears an even number of times.",
    evaluate: holders => {
      const matches = holders.filter(h => allEvenCounts(body(h)));
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 32,
    name: "Split Personality",
    description: "XOR of first 20 hex digits equals XOR of last 20.",
    evaluate: holders => {
      const matches = holders.filter(h => {
        const b = body(h);
        return xorHexDigits(b.slice(0, 20)) === xorHexDigits(b.slice(20, 40));
      });
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 33,
    name: "The Sandwich",
    description: "Most XYX patterns where Y is a smaller hex value than X.",
    evaluate: holders => pickByMax(holders, h => sandwichCount(body(h)), { fallbackOnZero: true }),
  },
  {
    id: 34,
    name: "The Zag Address",
    description: "Longest XYXY alternating-pair run (length >= 4).",
    evaluate: holders => pickByMax(holders, h => zagBestLen(body(h)), { fallbackOnZero: true }),
  },

  // 35-47: math
  {
    id: 35,
    name: "Top of the Food Chain",
    description: "Highest numeric address value.",
    evaluate: holders => {
      let best = holders[0];
      let bestN = addrToBigInt(best);
      for (const h of holders) {
        const n = addrToBigInt(h);
        if (n > bestN) {
          best = h;
          bestN = n;
        }
      }
      return best;
    },
  },
  {
    id: 36,
    name: "Humbled",
    description: "Lowest numeric address value (excluding 0x000…).",
    evaluate: holders => {
      const filtered = holders.filter(h => addrToBigInt(h) !== 0n);
      const pool = filtered.length ? filtered : holders;
      let best = pool[0];
      let bestN = addrToBigInt(best);
      for (const h of pool) {
        const n = addrToBigInt(h);
        if (n < bestN) {
          best = h;
          bestN = n;
        }
      }
      return best;
    },
  },
  {
    id: 37,
    name: "Wheel of Fortune",
    description: "A random holder.",
    evaluate: holders => randomChoice(holders),
  },
  {
    id: 38,
    name: "Sum of All Nice",
    description: "Sum of all hex digit values closest to 69 (abs distance).",
    evaluate: holders => {
      // Pick min (so higher score = closer): score = -|sum - 69|
      return pickByMax(holders, h => -Math.abs(sumHexDigits(body(h)) - 69));
    },
  },
  {
    id: 39,
    name: "Galaxy Brain",
    description: "Most prime hex digits (2, 3, 5, 7, b, d).",
    evaluate: holders => {
      const primeChars = new Set(["2", "3", "5", "7", "b", "d"]);
      return pickByMax(holders, h => {
        let n = 0;
        for (const c of body(h)) if (primeChars.has(c)) n++;
        return n;
      });
    },
  },
  {
    id: 40,
    name: "The Honors Student",
    description: "Most perfect-square hex digits (0, 1, 4, 9).",
    evaluate: holders => {
      const squareChars = new Set(["0", "1", "4", "9"]);
      return pickByMax(holders, h => {
        let n = 0;
        for (const c of body(h)) if (squareChars.has(c)) n++;
        return n;
      });
    },
  },
  {
    id: 41,
    name: "Stays Prime Under Pressure",
    description: "Sum of hex digit values is prime.",
    evaluate: holders => {
      const matches = holders.filter(h => isPrime(sumHexDigits(body(h))));
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 42,
    name: "Perfect Form",
    description: "Sum of hex digit values is a perfect square.",
    evaluate: holders => {
      const matches = holders.filter(h => isSquareInt(sumHexDigits(body(h))));
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 43,
    name: "Full Circle",
    description: "Sum of hex digit values is a palindrome (read in decimal).",
    evaluate: holders => {
      const matches = holders.filter(h => isPalindromeNum(sumHexDigits(body(h))));
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
  {
    id: 44,
    name: "Closest to CLAWD",
    description: "Numerically closest BigInt to the CLAWD contract address.",
    evaluate: holders => {
      let best = holders[0];
      let bestDiff = bigAbsDiff(addrToBigInt(best), CLAWD_TOKEN_BIG);
      for (const h of holders) {
        const d = bigAbsDiff(addrToBigInt(h), CLAWD_TOKEN_BIG);
        if (d < bestDiff) {
          best = h;
          bestDiff = d;
        }
      }
      return best;
    },
  },
  {
    id: 45,
    name: "Your Hex Twin",
    description: "Numerically closest holder to the connected sender.",
    evaluate: (holders, senderAddress) => {
      const sender = senderAddress.toLowerCase();
      const senderN = addrToBigInt(sender);
      const pool = holders.filter(h => h !== sender);
      const search = pool.length ? pool : holders;
      let best = search[0];
      let bestDiff = bigAbsDiff(addrToBigInt(best), senderN);
      for (const h of search) {
        const d = bigAbsDiff(addrToBigInt(h), senderN);
        if (d < bestDiff) {
          best = h;
          bestDiff = d;
        }
      }
      return best;
    },
  },
  {
    id: 46,
    name: "The Holy Equation",
    description: "(address mod 420) closest to 69.",
    evaluate: holders =>
      pickByMax(holders, h => {
        const m = Number(addrToBigInt(h) % 420n);
        return -Math.abs(m - 69);
      }),
  },
  {
    id: 47,
    name: "Total Chaos",
    description: "XOR of all 20 address bytes equals 0x69.",
    evaluate: holders => {
      const matches = holders.filter(h => xorAddressBytes(body(h)) === 0x69);
      if (matches.length) return randomChoice(matches);
      return randomChoice(holders);
    },
  },
];

// Re-export length sanity for consumer code
export const CRITERIA_COUNT = criteria.length;
// Suppress unused-var lints on helpers used only conditionally
void HEX;
void isLetter;
