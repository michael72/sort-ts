export class Content {
  public lines: Array<string> = [];
  public toString(endl: string): string {
    return this.lines.join(endl);
  }
}
