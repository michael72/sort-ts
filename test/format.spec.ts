/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { format } from "../src/format";

import { should } from "chai";
should();

describe("format", () => {
  it("should format members of a class in call order", () => {
    const original = `class Foo {
  fun1(): void {
    this._fun2();
    this._fun3();
  }

  // comment to fun3
  private _fun3(): void {
    console.log("hello");
  }

  // comment to fun2
  private _fun2(): void {
    console.log("ciao");
    this._fun4();
  }

  private _fun4(): void {}
}
`;
    const expected = `class Foo {
  fun1(): void {
    this._fun2();
    this._fun3();
  }

  // comment to fun2
  private _fun2(): void {
    console.log("ciao");
    this._fun4();
  }

  private _fun4(): void {
  }

  // comment to fun3
  private _fun3(): void {
    console.log("hello");
  }
}
`;

    const actual = format(original);
    actual.should.equal(expected);
  });

  it("should sort functions by call chain, exported functions first", () => {
    const original = `function fun3() {
  console.log("}");
}

function fun2(): void {
  fun3();
}

export function fun1(): void {
  fun2();
}
`;
    const expected = `
export function fun1(): void {
  fun2();
}

function fun2(): void {
  fun3();
}

function fun3() {
  console.log("}");
}
`;
    const actual = format(original);
    actual.should.equal(expected);
  });

  it("should support generators", () => {
    const original = `class Foo {
  private _fun3(): void {
    console.log("done");
  }
  private _other(): string {
    return "world";
  }
  private *_gen(): Generator<string> {
    yield "hello";
    yield this._other();
  }
  fun() {
    for (const item of this._gen()) {
      console.log(item);
    }
    this._fun3();
  }
}
`;

    const expected = `class Foo {
  fun() {
    for (const item of this._gen()) {
      console.log(item);
    }
    this._fun3();
  }

  private *_gen(): Generator<string> {
    yield "hello";
    yield this._other();
  }

  private _other(): string {
    return "world";
  }

  private _fun3(): void {
    console.log("done");
  }
}
`;
    const actual = format(original);
    actual.should.equal(expected);
  });

  it("should sort public functions in alphabetical order, constructors going first", () => {
    const original = `class A {
  *items(): Generator<string> {
    // some comment (
    const str = "\\"";
    for (const i of this._items) {
      yield i;
    }
  }

  constructor(private _items: Array<string>) { }

  remove(a: string) {
    /* some other comment } */
    this._items.splice(this._items.indexOf(a), 1);
  }

  add(a: string) {
    this._items.push(a);
  }
}
`;
    const expected = `class A {
  constructor(private _items: Array<string>) { 
  }

  add(a: string) {
    this._items.push(a);
  }

  *items(): Generator<string> {
    // some comment (
    const str = "\\"";
    for (const i of this._items) {
      yield i;
    }
  }

  remove(a: string) {
    /* some other comment } */
    this._items.splice(this._items.indexOf(a), 1);
  }
}
`;

    const actual = format(original);
    actual.should.equal(expected);
  });
});
