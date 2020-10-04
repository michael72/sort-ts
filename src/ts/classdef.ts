import { Content } from "./content";
import { FunctionDef } from "./functiondef";

export class ClassDef {
  public header = new Content();
  public footer = new Content();
  public functions: Array<FunctionDef> = [];
  constructor(public global: boolean) {}

  public add(line: string): void {
    this.header.lines.push(line);
  }

  public empty(): boolean {
    return this.header.lines.length == 0 && this.functions.length == 0;
  }

  public extractMethod(name: string): FunctionDef | undefined {
    const idx = this.functions.findIndex((f) => f.name == name);
    if (idx != -1) {
      return this.functions.splice(idx, 1)[0];
    }
    return;
  }

  public finish(): void {
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
}
