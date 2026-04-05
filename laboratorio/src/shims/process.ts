type HrtimeTuple = [number, number];

type BrowserProcess = {
  env: Record<string, string | undefined>;
  argv: string[];
  cwd: () => string;
  exit: (code?: number) => void;
  hrtime: (previous?: HrtimeTuple) => HrtimeTuple;
  stdout: {
    write: (chunk?: unknown) => boolean;
  };
  stderr: {
    write: (chunk?: unknown) => boolean;
  };
};

declare global {
  var process: BrowserProcess | undefined;
  var global: typeof globalThis | undefined;
}

function toHrtimeTuple(milliseconds: number): HrtimeTuple {
  const totalNanoseconds = Math.floor(milliseconds * 1_000_000);
  const seconds = Math.floor(totalNanoseconds / 1_000_000_000);
  const nanoseconds = totalNanoseconds - seconds * 1_000_000_000;
  return [seconds, nanoseconds];
}

function createHrtime(previous?: HrtimeTuple): HrtimeTuple {
  const current = toHrtimeTuple(globalThis.performance?.now?.() ?? Date.now());
  if (!previous) {
    return current;
  }

  let seconds = current[0] - previous[0];
  let nanoseconds = current[1] - previous[1];

  if (nanoseconds < 0) {
    seconds -= 1;
    nanoseconds += 1_000_000_000;
  }

  return [seconds, nanoseconds];
}

const noopWrite = () => true;

if (!globalThis.process) {
  globalThis.process = {
    env: {},
    argv: [],
    cwd: () => "/",
    exit: () => undefined,
    hrtime: createHrtime,
    stdout: { write: noopWrite },
    stderr: { write: noopWrite },
  };
} else {
  globalThis.process.env ??= {};
  globalThis.process.argv ??= [];
  globalThis.process.cwd ??= () => "/";
  globalThis.process.exit ??= () => undefined;
  globalThis.process.hrtime ??= createHrtime;
  globalThis.process.stdout ??= { write: noopWrite };
  globalThis.process.stderr ??= { write: noopWrite };
}

globalThis.global = globalThis;

export {};
