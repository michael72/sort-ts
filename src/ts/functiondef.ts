import { Call } from "./call";
import { Content } from "./content";

export const REGEX_METHOD = /(?:^[\t ]*)(?:(?:private|protected|public|function|export function) )?[*]?(\w+)\(/;
export const REGEX_CALL = /(^|\s+|this\.)(\w+)\([^()]*\)[^:]/gm;
export const REGEX_SPACES = /^[\r\n]*(\s*).*/;

export class FunctionDef {
  private header = "";
  public name = "";
  public visibility = "public";
  private comments = new Content();
  private body = new Content();

  constructor(private global: boolean) {
    this.visibility = global ? "private" : "public";
  }

  public add(line: string): void {
    this.body.lines.push(line);
    this._parse();
  }

  *calls(): Generator<Call> {
    const s = this.body.toString("\n");
    for (const m of s.matchAll(REGEX_CALL)) {
      yield new Call(m[1], m[2]);
    }
  }

  public empty(): boolean {
    return this.body.lines.length == 0;
  }

  public finish(prev: FunctionDef): void {
    const last = () => prev.body.lines[prev.body.lines.length - 1].trim();
    while (prev.body.lines.length > 0 && last() !== "}") {
      const l = prev.body.lines.splice(prev.body.lines.length - 1, 1)[0];
      if (l.trim()) {
        this.comments.lines = [l, ...this.comments.lines];
      }
    }
  }

  public finished(): boolean {
    const closing = new Array<string>();
    const peek = (): string | undefined => {
      return closing.length == 0 ? undefined : closing[closing.length - 1];
    };
    let last = "";
    let inComment = false;
    let inString = false;
    const all = [this.header, ...this.body.lines];
    for (const line of all) {
      let inLineComment = false;
      let inEsc = false;
      for (const c of line) {
        if (c === "*" && last === "/") {
          inComment = true;
        } else if (c === "/") {
          if (last === "/") {
            inLineComment = true;
          } else if (last === "*") {
            inComment = false;
          }
        }
        if (inEsc || c === "\\") {
          inEsc = inEsc == false;
        } else {
          if (!inComment && !inLineComment && !inEsc) {
            if (c === '"' || c === "'" || c === "´") {
              if (peek() === c) {
                closing.pop();
                inString = false;
              } else if (!inString) {
                closing.push(c);
                inString = true;
              }
            } else if (!inString) {
              const brackets = "(){}[]";
              const idx = brackets.indexOf(c);
              if (idx !== -1) {
                const opening = (idx & 1) === 0;
                if (opening) {
                  closing.push(brackets[idx + 1]);
                } else if (peek() == c) {
                  closing.pop();
                }
              }
            }
          }
          last = c;
        }
      }
    }
    return closing.length == 0;
  }

  public lastItem(): string {
    return this.body.lines[this.body.lines.length - 1];
  }

  public removeLast(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.body.lines.pop()!;
  }

  public toString(endl: string): string {
    let res = endl + this.comments.toString(endl);
    if (this.comments.lines.length > 0) {
      res += endl;
    }
    res += this.header + endl + this.body.toString(endl);
    return res + endl;
  }

  private _parse() {
    if (this.name === "") {
      this.header = this.body.lines.splice(0, 1)[0];
      this._checkVisibility();
      const m = REGEX_METHOD.exec(this.header);
      if (m) {
        this.name = m[1];
      } else {
        throw new Error("expected function definition in first line");
      }
      this._checkEmptyFunction();
    }
  }

  private _checkVisibility() {
    const h = this.header.trim();
    if (this.global) {
      if (h.startsWith("export")) {
        this.visibility = "public";
      }
    } else {
      for (const v of ["private", "protected"]) {
        if (h.startsWith(v)) {
          this.visibility = v;
          break;
        }
      }
    }
  }

  private _checkEmptyFunction() {
    const idx = this.header.indexOf("}");
    if (idx != -1) {
      this.body.lines.push(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        REGEX_SPACES.exec(this.header)![1] + this.header.substring(idx)
      );
      this.header = this.header.substring(0, idx);
    }
  }
}
