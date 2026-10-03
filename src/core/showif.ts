/**
 * Evaluates the `showIf` expressions of VIA menus, e.g.
 *   "{id_qmk_rgb_matrix_effect} != 0 && {id_qmk_rgb_matrix_effect} < 4"
 * `{name}` reads the current value of another control.
 */

const TOKEN = /\s*(\{[^}]+\}|\d+|&&|\|\||==|!=|>=|<=|>|<|!|\(|\))/y;

const COMPARE: Record<string, (a: number, b: number) => boolean> = {
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
};

function tokenize(expression: string): string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < expression.length) {
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(expression);
    if (!match) {
      if (expression.slice(start).trim() === '') break;
      throw new Error(`Unexpected text in "${expression}"`);
    }
    tokens.push(match[1]);
  }
  return tokens;
}

/**
 * Returns whether a control should be shown. Anything that cannot be evaluated
 * (unknown value, unsupported syntax) shows the control rather than hiding it.
 */
export function evaluateShowIf(
  expression: string | undefined,
  lookup: (id: string) => number | undefined,
): boolean {
  if (!expression) return true;
  try {
    const tokens = tokenize(expression);
    let position = 0;
    const peek = () => tokens[position];
    const take = () => tokens[position++];

    const primary = (): number => {
      const token = take();
      if (token === undefined) throw new Error('Unexpected end');
      if (token === '(') {
        const value = or();
        if (take() !== ')') throw new Error('Missing )');
        return value;
      }
      if (token.startsWith('{')) {
        const value = lookup(token.slice(1, -1).trim());
        if (value === undefined) throw new Error(`Unknown value ${token}`);
        return value;
      }
      if (/^\d+$/.test(token)) return Number(token);
      throw new Error(`Unexpected ${token}`);
    };
    const comparison = (): number => {
      const left = primary();
      const compare = COMPARE[peek()];
      if (!compare) return left;
      take();
      return compare(left, primary()) ? 1 : 0;
    };
    const not = (): number => {
      if (peek() !== '!') return comparison();
      take();
      return not() ? 0 : 1;
    };
    const and = (): number => {
      let value = not();
      while (peek() === '&&') {
        take();
        const right = not();
        value = value && right ? 1 : 0;
      }
      return value;
    };
    const or = (): number => {
      let value = and();
      while (peek() === '||') {
        take();
        const right = and();
        value = value || right ? 1 : 0;
      }
      return value;
    };

    const result = or();
    if (position < tokens.length) throw new Error('Trailing tokens');
    return result !== 0;
  } catch {
    return true;
  }
}
