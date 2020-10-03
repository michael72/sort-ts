/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { format } from "../src/format";

import { should } from "chai";
should();

describe("format", () => {
  it("should format members of a class in call order", () => {
    const original = `class Foo {
  fun1() {
    this._fun2();
    this._fun3();
  }

  private _fun3() {
    console.log("hello");
  }

  private _fun2() {
    console.log("ciao");
  }
}
`;
    const expected = `class Foo {
  fun1() {
    this._fun2();
    this._fun3();
  }

  private _fun2() {
    console.log("ciao");
  }

  private _fun3() {
    console.log("hello");
  }
}
`;

    const actual = format(original);
    actual.should.equal(expected);
  });
});
