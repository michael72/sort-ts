import { ClassDef } from "./ts/classdef";
import { FunctionDef } from "./ts/functiondef";
import { REGEX_METHOD } from "./ts/functiondef";

// simple implementation:
// parse each line
// class { --> class definition until next class
// function ... {  -> function definition until next ...
// method(): foo { -> method definition until next ...

const REGEX_CLASS = /class \w+ {/;

export class Parser {
  public classes: Array<ClassDef> = [];
  public endl = "\n";
  constructor(private input: string) {}

  public parse(): Array<ClassDef> {
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
    return this.classes;
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
