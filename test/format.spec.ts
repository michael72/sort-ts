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
    const original = `function fun2(): void {
  fun3();
}

export function fun1(): void {
  fun2();
}

function fun3() {
  console.log("hello");
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
  console.log("hello");
}
`;
    const actual = format(original);
    actual.should.equal(expected);
  });
});
