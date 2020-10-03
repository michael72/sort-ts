// simple implementation:
// parse each line
// class { --> class definition until next class
// function ... {  -> function definition until next ...
// method(): foo { -> method definition until next ...

import { DefaultMap } from "./helpers";

const REGEX_METHOD = /(?:\w+ )?(\w+)\([^()]*\): \w+ {/m;
const REGEX_CALL = /(^|\s+|this\.)(\w+)\([^()]*\)[^:]/m;
const REGEX_CLASS = /class \w+ {/;

class Call {
  constructor(public object: string, public fun: string) {}
}

class FunctionDef {
  private header = "";
  public name = "";
  public isPublic = true;
  constructor(private content: Content) {}

  toString(): string {
    return this.content.toString();
  }

  *calls(): Generator<Call> {
    const s = this.content.toString();
    let m = REGEX_CALL.exec(s);
    while (m) {
      yield new Call(m[1], m[2]);
      m = REGEX_CALL.exec(s);
    }
  }

  private _parse() {
    if (this.name === "") {
      this.header = this.content.lines.splice(0, 1)[0];
      const m = REGEX_METHOD.exec(this.header);
      if (m) {
        this.name = m[1];
      } else {
        throw new Error("expected function definition in first line");
      }
    }
  }

  public add(line: string) {
    this.content.lines.push(line);
    this._parse();
  }

  public removeLast(): string {
    return this.content.lines.pop()!;
  }

  public empty(): boolean {
    return this.content.lines.length == 0;
  }
}

class ClassDef {
  constructor(private content: Content) {}
  public functions: Array<FunctionDef> = [];
  public add(line: string) {
    this.content.lines.push(line);
  }
  public empty(): boolean {
    return this.content.lines.length == 0;
  }
  public finish() {
    if (this.functions.length > 0) {
      const last = this.functions[this.functions.length - 1];
      this.content.lines.push(last.removeLast());
    }
  }
}

class Content {
  public lines: Array<string> = [];
  public toString(): string {
    return this.lines.join("\n");
  }
}

class Formatter {
  public header: Array<string> = [];
  public functions: Array<FunctionDef> = [];
  public classes: Array<ClassDef> = [];
  private endl = "\n";
  constructor(private input: string) {}

  sort(): string {
    this._parse();
    let res = this.header.join("\n");
    for (const f of this.functions) {
      res = res + this.endl + f.toString();
      // TODO sort functions?
    }
    for (const c of this.classes) {
      const calls = new DefaultMap<string, Array<string>>(() => []);
      for (const f of c.functions) {
        for (const call of f.calls()) {
          if (call.object === "this") {
            calls.getDef(f.name).push(call.fun);
          }
        }
      }
    }
    return res;
  }

  private _parse(): void {
    this.endl = this._determineEndl();
    let currentClass: ClassDef | undefined;
    let currentFunction: FunctionDef | undefined;
    const addFunction = () => {
      if (currentFunction !== undefined && !currentFunction.empty()) {
        if (currentClass === undefined) {
          this.functions.push(currentFunction);
        } else {
          currentClass.functions.push(currentFunction);
        }
      }
    };
    const addClass = () => {
      addFunction();
      if (currentClass !== undefined && !currentClass.empty()) {
        currentClass.finish();
        this.classes.push(currentClass);
      }
    };

    for (const line of this.input.split(this.endl)) {
      if (REGEX_METHOD.exec(line)) {
        addFunction();
        currentFunction = new FunctionDef(new Content());
      } else if (REGEX_CLASS.exec(line)) {
        addClass();
        currentClass = new ClassDef(new Content());
      }
      if (currentFunction !== undefined) {
        currentFunction.add(line);
      } else if (currentClass === undefined) {
        this.header.push(line);
      } else {
        currentClass.add(line);
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
