import { Parser } from "./parser";
import { ClassDef } from "./ts/classdef";
import { FunctionDef } from "./ts/functiondef";
import { Call } from "./ts/call";

// simple implementation:
// parse each line
// class { --> class definition until next class
// function ... {  -> function definition until next ...
// method(): foo { -> method definition until next ...

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

class Formatter {
  constructor(private input: string) {}

  sort(): string {
    const parser = new Parser(this.input);
    const classes = parser.parse();
    return classes
      .map((c) => new FormatClass(c, parser.endl).format())
      .join("")
      .substring(1);
  }
}

class FormatClass {
  calls = new Set<string>();
  constructor(private c: ClassDef, private endl: string) {}
  public format(): string {
    const res =
      this.endl +
      this.c.header.lines.join(this.endl) +
      this._orderFunctions()
        .map((f) => f.toString(this.endl))
        .join("") +
      (this.c.footer.lines.length > 0
        ? this.c.footer.lines.join(this.endl) + this.endl
        : "");

    return res;
  }

  private _orderFunctions(): Array<FunctionDef> {
    let ordered = this._movePublicFunctionsToOrdered();
    // add dependencies depth first
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < ordered.length; i++) {
      ordered = ordered.concat(this._collectOrdered(ordered[i]));
    }
    // add remaining functions sorted by name
    return ordered.concat(this.c.functions.sort(sortByName));
  }

  private _movePublicFunctionsToOrdered(): Array<FunctionDef> {
    const ordered = this.c.functions.filter((f) => f.visibility === "public");
    for (const f of ordered) {
      // remove already ordered from c.functions
      this.c.functions.splice(this.c.functions.indexOf(f), 1);
    }
    return ordered.sort(sortByName);
  }

  private _collectOrdered(f: FunctionDef): Array<FunctionDef> {
    let ordered = new Array<FunctionDef>();
    for (const call of f.calls()) {
      if (!this.calls.has(call.fun)) {
        this.calls.add(call.fun);
        ordered = ordered.concat(this._moveToOrdered(call));
      }
    }
    return ordered;
  }

  private _moveToOrdered(call: Call): Array<FunctionDef> {
    const ordered = new Array<FunctionDef>();
    const m = this.c.extractMethod(call.fun);
    if (m !== undefined) {
      ordered.push(m);
      return ordered.concat(this._collectOrdered(m));
    }
    return ordered;
  }
}
