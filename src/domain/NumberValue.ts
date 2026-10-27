/** All geometry crosses this boundary, including arithmetic results. */
export class NumberValue {
  static parse(value: string | number, name = 'number'): number {
    const text = String(value).trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      throw new Error(`invalid ${name}: ${value}`);
    }
    const number = Number(text);
    if (!Number.isFinite(number)) throw new Error(`invalid ${name}: ${value}`);
    return Object.is(number, -0) ? 0 : number;
  }

  static nonnegative(value: string | number, name: string): number {
    const result = this.parse(value, name);
    if (result < 0) throw new Error(`${name} must be non-negative`);
    return result;
  }

  static positive(value: string | number, name: string): number {
    const result = this.parse(value, name);
    if (result <= 0) throw new Error(`${name} must be positive`);
    return result;
  }

  static format(value: number): string {
    return String(Object.is(value, -0) ? 0 : value);
  }
}
