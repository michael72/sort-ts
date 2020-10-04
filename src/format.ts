// simple implementation:
// parse each line
// class { --> class definition until next class
// function ... {  -> function definition until next ...
// method(): foo { -> method definition until next ...

const REGEX_METHOD = /(?:^[\t ]*)(?:(?:private|protected|public|function|export function) )?[*]?(\w+)\(/;
const REGEX_CALL = /(^|\s+|this\.)(\w+)\([^()]*\)[^:]/gm;
const REGEX_CLASS = /class \w+ {/;
const REGEX_SPACES = /^[\r\n]*(\s*).*/;

export function format(txt: string): string {
  const formatter = new Formatter(txt);
  return formatter.sort();
}

function sortByName(a: FunctionDef, b: FunctionDef): number {
  const filterName = (n: string) => {
    // constructor sorted in first
    return n == "constructor" ? " " : n.startsWith("*") ? n.substring(1) : n;
  };
  return filterName(a.name) < filterName(b.name) ? -1 : 1;
}

class Call {
  constructor(public object: string, public fun: string) {
    if (this.object.endsWith(".")) {
      this.object = this.object.substring(0, this.object.length - 1);
    }
  }
}

class FunctionDef {
  private header = "";
  public name = "";
  public visibility = "public";
  private comments = new Content();
  private body = new Content();

  constructor(private global: boolean) {
    this.visibility = global ? "private" : "public";
  }

  *calls(): Generator<Call> {
    const s = this.body.toString("\n");
    for (const m of s.matchAll(REGEX_CALL)) {
      yield new Call(m[1], m[2]);
    }
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

  public add(line: string) {
    this.body.lines.push(line);
    this._parse();
  }

  public removeLast(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.body.lines.pop()!;
  }

  public lastItem(): string {
    return this.body.lines[this.body.lines.length - 1];
  }

  public empty(): boolean {
    return this.body.lines.length == 0;
  }

  public finish(prev: FunctionDef) {
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
        } else if (c === "\\" || inEsc) {
          inEsc = inEsc == false;
        }
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
    return closing.length == 0;
  }

  public toString(endl: string): string {
    let res = endl + this.comments.toString(endl);
    if (this.comments.lines.length > 0) {
      res += endl;
    }
    res += this.header + endl + this.body.toString(endl);
    return res + endl;
  }
}

class ClassDef {
  public header = new Content();
  public footer = new Content();
  public functions: Array<FunctionDef> = [];
  constructor(public global: boolean) {}

  public add(line: string) {
    this.header.lines.push(line);
  }
  public empty(): boolean {
    return this.header.lines.length == 0 && this.functions.length == 0;
  }
  public finish() {
    if (this.functions.length > 0) {
      const last = this.functions[this.functions.length - 1];
      while (
        this.functions.length > 0 &&
        (!this.global || last.lastItem().trim() !== "}")
      ) {
        const l = last.removeLast();
        if (l.trim()) {
          this.footer.lines.push(l);
          if (l.trim() === "}") {
            break;
          }
        }
      }
    }
  }
  public extractMethod(name: string): FunctionDef | undefined {
    const idx = this.functions.findIndex((f) => f.name == name);
    if (idx != -1) {
      return this.functions.splice(idx, 1)[0];
    }
    return;
  }
}

class Content {
  public lines: Array<string> = [];
  public toString(endl: string): string {
    return this.lines.join(endl);
  }
}

class Formatter {
  public classes: Array<ClassDef> = [];
  private endl = "\n";
  constructor(private input: string) {}

  sort(): string {
    this._parse();
    return this.classes
      .map((c) => this._formatClass(c))
      .join("")
      .substring(1);
  }

  private _formatClass(c: ClassDef): string {
    const res =
      this.endl +
      c.header.lines.join(this.endl) +
      this._orderFunctions(c)
        .map((f) => f.toString(this.endl))
        .join("") +
      (c.footer.lines.length > 0
        ? c.footer.lines.join(this.endl) + this.endl
        : "");

    return res;
  }

  private _orderFunctions(c: ClassDef) {
    let ordered = this._movePublicToOrdered(c);
    const calls = new Set<string>();
    // add dependencies depth first
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < ordered.length; i++) {
      ordered = ordered.concat(this._collectOrdered(c, ordered[i], calls));
    }
    // add remaining functions sorted by name
    return ordered.concat(c.functions.sort(sortByName));
  }

  private _movePublicToOrdered(c: ClassDef) {
    const ordered = c.functions.filter((f) => f.visibility === "public");
    for (const f of ordered) {
      // remove already ordered from c.functions
      c.functions.splice(c.functions.indexOf(f), 1);
    }
    return ordered.sort(sortByName);
  }

  private _collectOrdered(
    c: ClassDef,
    f: FunctionDef,
    calls: Set<string>
  ): Array<FunctionDef> {
    let ordered = new Array<FunctionDef>();
    for (const call of f.calls()) {
      if (!calls.has(call.fun)) {
        calls.add(call.fun);
        ordered = ordered.concat(this._moveToOrdered(c, call, calls));
      }
    }
    return ordered;
  }

  private _moveToOrdered(
    c: ClassDef,
    call: Call,
    calls: Set<string>
  ): Array<FunctionDef> {
    const ordered = new Array<FunctionDef>();
    const m = c.extractMethod(call.fun);
    if (m !== undefined) {
      ordered.push(m);
      return ordered.concat(this._collectOrdered(c, m, calls));
    }
    return ordered;
  }

  private _parse(): void {
    this.endl = this._determineEndl();
    let currentClass = new ClassDef(true);
    let currentFunction: FunctionDef | undefined;
    let prevFunction: FunctionDef | undefined;
    const addFunction = () => {
      if (currentFunction !== undefined && !currentFunction.empty()) {
        currentClass.functions.push(currentFunction);
        if (prevFunction !== undefined) {
          currentFunction.finish(prevFunction);
        }
        prevFunction = currentFunction;
        currentFunction = undefined;
      }
    };
    const addClass = () => {
      addFunction();
      if (!currentClass.empty()) {
        currentClass.finish();
        this.classes.push(currentClass);
      }
    };

    for (const lines of this.input.split(this.endl)) {
      for (const line of lines.split("\n")) {
        if (!line.startsWith("//")) {
          if (
            REGEX_METHOD.exec(line) &&
            (currentFunction == undefined || currentFunction.finished())
          ) {
            addFunction();
            currentFunction = new FunctionDef(currentClass.global);
          } else if (REGEX_CLASS.exec(line)) {
            addClass();
            currentClass = new ClassDef(false);
          }
        }
        if (currentFunction === undefined) {
          currentClass.add(line);
        } else {
          currentFunction.add(line);
        }
      }
    }
    addClass();
  }

  private _determineEndl(): string {
    if (this.input.includes("\r")) {
      if (this.input.includes("\n")) {
        return "\r\n";
      }
      return "\r";
    }
    return "\n";
  }
}
