// simple implementation:
// parse each line
// class { --> class definition until next class
// function ... {  -> function definition until next ...
// method(): foo { -> method definition until next ...

const REGEX_METHOD = /(?:^[\t ]*)(?:(?:private|protected|function|export function) )?(\w+)\([^()]*\)(?:: \w+)? {(?:})?/m;
const REGEX_CALL = /(^|\s+|this\.)(\w+)\([^()]*\)[^:]/gm;
const REGEX_CLASS = /class \w+ {/;
const REGEX_SPACES = /^[\r\n]*(\s*).*/;

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
    let m = REGEX_CALL.exec(s);
    while (m) {
      yield new Call(m[1], m[2]);
      m = REGEX_CALL.exec(s);
    }
  }

  private _parse() {
    if (this.name === "") {
      this.header = this.body.lines.splice(0, 1)[0];
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
      const m = REGEX_METHOD.exec(this.header);
      if (m) {
        this.name = m[1];
      } else {
        throw new Error("expected function definition in first line");
      }
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

  public toString(endl: string): string {
    let res = this.comments.toString(endl);
    if (this.comments.lines.length > 0) {
      res += endl;
    }
    res += this.header + endl + this.body.toString(endl);
    return res;
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
      while (this.functions.length > 0) {
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
    let res = "";

    for (const c of this.classes) {
      const calls = new Set<string>();
      let ordered: Array<FunctionDef> = [];
      for (let i = 0; i < c.functions.length; i++) {
        const f = c.functions[i];
        if (f.visibility === "public") {
          ordered.push(c.functions.splice(i, 1)[0]);
        }
      }

      // add dependencies depth first
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let j = 0; j < ordered.length; j++) {
        this._addDeps(calls, c, ordered, ordered[j]);
      }

      ordered = ordered.concat(c.functions);
      if (res !== "") {
        res = res + this.endl;
      }
      res = res + c.header.lines.join(this.endl);
      let first = true;
      for (const f of ordered) {
        if (!first) {
          res = res + this.endl;
        }
        res = res + this.endl + f.toString(this.endl);

        first = false;
      }
      res = res + this.endl + c.footer.lines.join(this.endl) + this.endl;
    }
    return res;
  }

  private _addDeps(
    calls: Set<string>,
    c: ClassDef,
    ordered: FunctionDef[],
    f: FunctionDef
  ) {
    for (const call of f.calls()) {
      if (!calls.has(call.fun)) {
        const m = c.extractMethod(call.fun);
        if (m !== undefined) {
          ordered.push(m);
          this._addDeps(calls, c, ordered, m);
        }
      }
    }
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

    for (const line of this.input.split(this.endl)) {
      if (REGEX_METHOD.exec(line)) {
        addFunction();
        currentFunction = new FunctionDef(currentClass.global);
      } else if (REGEX_CLASS.exec(line)) {
        addClass();
        currentClass = new ClassDef(false);
      }
      if (currentFunction === undefined) {
        currentClass.add(line);
      } else {
        currentFunction.add(line);
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

export function format(txt: string): string {
  const formatter = new Formatter(txt);
  return formatter.sort();
}
