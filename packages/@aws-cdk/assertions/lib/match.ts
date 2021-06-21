import { ABSENT } from './vendored/assert';

export interface MatchFailure {
  readonly path: string[];
  readonly message: string;
}

/**
 * Partial and special matching during template assertions
 */
export abstract class Match {
  /**
   * Use this matcher in the place of a field's value, if the field must not be present.
   */
  public static absentProperty(): string {
    return ABSENT;
  }

  public static arrayWith(pattern: any[]): Match {
    return new ArrayWithMatch(pattern);
  }

  public static objectLike(pattern: {[key: string]: any}): Match {
    return new ObjectLikeMatch(pattern);
  }

  public static isMatcher(x: any): x is Match {
    return x && x instanceof Match;
  }

  public abstract test(actual: any): MatchFailure[];
}

export class ExactMatch extends Match {
  constructor(private readonly pattern: any) {
    super();

    if (Match.isMatcher(this.pattern)) {
      throw new Error('ExactMatch cannot be nested with another matcher at the top level. Deeper nesting is allowed.');
    }
  }

  public test(actual: any): MatchFailure[] {
    if (Array.isArray(this.pattern)) {
      if (!Array.isArray(actual)) {
        return [{ path: [], message: `Expected type array but received ${typeof actual}` }];
      }

      if (this.pattern.length !== actual.length) {
        return [{ path: [], message: `Expected array of length ${this.pattern.length} but received ${actual.length}` }];
      }

      const failures: MatchFailure[] = [];
      for (let i = 0; i < this.pattern.length; i++) {
        const p = this.pattern[i];
        const matcher = Match.isMatcher(p) ? p : new ExactMatch(p);
        const innerFailures = matcher.test(actual[i]);
        failures.push(...composeFailures(`[${i}]`, innerFailures));
      }

      return failures;
    }

    if (typeof this.pattern === 'object') {
      if (Array.isArray(actual)) {
        return [{ path: [], message: 'Expected type object but received array' }];
      }

      if (typeof actual !== 'object') {
        return [{ path: [], message: `Expected type object but received ${typeof actual}` }];
      }

      return new ObjectLikeMatch(this.pattern, { exact: true }).test(actual);
    }

    if (typeof this.pattern !== typeof actual) {
      return [{ path: [], message: `Expected type ${typeof this.pattern} but received ${getType(actual)}` }];
    }

    if (actual !== this.pattern) {
      return [{ path: [], message: `Expected ${this.pattern} but received ${actual}` }];
    }

    return [];
  }
}

export class ArrayWithMatch extends Match {
  constructor(private readonly pattern: any[]) {
    super();
  }

  public test(actual: any): MatchFailure[] {
    if (!Array.isArray(actual)) return [{ path: [], message: 'FIXME' }];
    if (this.pattern.length > actual.length) return [{ path: [], message: 'FIXME' }];

    let patternIdx = 0;
    let actualIdx = 0;

    while (patternIdx < this.pattern.length && actualIdx < actual.length) {
      let patternElement = this.pattern[patternIdx];
      let matcher = Match.isMatcher(patternElement) ? patternElement : new ExactMatch(patternElement);
      const m = matcher.test(actual[actualIdx]);
      if (m) {
        patternIdx++;
      } else {
        actualIdx++;
      }
    }

    if (patternIdx === this.pattern.length) {
      return [];
    }
    return [{ path: [], message: 'FIXME' }];
  }
}

export interface ObjectLikeMatchOptions {
  readonly exact?: boolean;
}

export class ObjectLikeMatch extends Match {
  private readonly exact: boolean;
  constructor(
    private readonly pattern: {[key: string]: any},
    options: ObjectLikeMatchOptions = {}) {

    super();
    this.exact = options.exact ?? false;
  }

  public test(actual: any): MatchFailure[] {
    if (typeof actual !== 'object') {
      return [{ path: [], message: `Expected type object but received ${getType(actual)}` }];
    }

    const failures: MatchFailure[] = [];
    if (this.exact) {
      for (const a of Object.keys(actual)) {
        if (!(a in this.pattern)) {
          failures.push({ path: [], message: `Unexpected key '${a}'` });
        }
      }
    }

    for (const [patternKey, patternVal] of Object.entries(this.pattern)) {
      if (!(patternKey in actual)) {
        failures.push({ path: [], message: `Missing key '${patternKey}'` });
        continue;
      }
      const matcher = Match.isMatcher(patternVal) ? patternVal : new ExactMatch(patternVal);
      const innerFailures = matcher.test(actual[patternKey]);
      failures.push(...composeFailures(`/${patternKey}`, innerFailures));
    }

    return failures;
  }
}

function getType(obj: any): string {
  return Array.isArray(obj) ? 'array' : typeof obj;
}

function composeFailures(relativePath: string, inner: MatchFailure[]): MatchFailure[] {
  return inner.map(f => {
    return { path: [relativePath, ...f.path], message: f.message };
  });
}