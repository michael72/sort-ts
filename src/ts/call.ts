export class Call {
  public constructor(public object: string, public fun: string) {
    if (this.object.endsWith(".")) {
      this.object = this.object.substring(0, this.object.length - 1);
    }
  }
}
