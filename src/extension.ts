import { format } from "./format";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

function formatSelection(textEditor: vscode.TextEditor): void {
  if (textEditor != null) {
    const document = textEditor.document;
    void textEditor.edit((editBuilder) => {
      for (const sel of textEditor.selections) {
        const range =
          sel.isEmpty || sel.isSingleLine
            ? document.lineAt(sel.active.line).range
            : sel;
        const lines = document.getText(range);
        const formatted = format(lines);
        editBuilder.replace(range, formatted);
      }
    }); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
  }
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  const formatTxt = vscode.commands.registerTextEditorCommand(
    "sortts.sort",
    (textEditor: vscode.TextEditor) => {
      formatSelection(textEditor);
    }
  );
  context.subscriptions.push(formatTxt);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  // nothing to do
}
