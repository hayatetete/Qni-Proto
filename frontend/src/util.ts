import * as defaultTheme from "tailwindcss/defaultTheme";

export const spacingInPx = function (value: number): number {
  if (value === 0.25) {
    return 1;
  } else {
    const remValue = parseFloat(
      defaultTheme.spacing[
        value.toString() as keyof typeof defaultTheme.spacing
      ]
    );
    const pxValue = remValue * 16; // 1rem = 16px

    return parseInt(pxValue.toFixed(0));
  }
};

export const groupBy = <K, V>(
  array: readonly V[],
  getKey: (current: V, index: number, orig: readonly V[]) => K
): Array<[K, V[]]> =>
  Array.from(
    array.reduce((map, current, index, orig) => {
      const key = getKey(current, index, orig);
      const list = map.get(key);
      if (list) {
        list.push(current);
      } else {
        map.set(key, [current]);
      }
      return map;
    }, new Map<K, V[]>())
  );

export function rectIntersect(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
) {
  if (x2 > w1 + x1 || x1 > w2 + x2 || y2 > h1 + y1 || y1 > h2 + y2) {
    return false;
  }
  return true;
}

export function need(
  condition: boolean,
  message: string,
  errorInfo?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    const errorMessage = Object.entries(errorInfo || {}).reduce(
      (msg, [key, value]) => msg.replace(`{${key}}`, String(value)),
      message
    );
    throw new Error(errorMessage);
  }
}

export function convertToKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export const logger = {
  log: (message: string) => {
    if (process.env.NODE_ENV === "development") {
      console.log(message);
    }
  },
};
