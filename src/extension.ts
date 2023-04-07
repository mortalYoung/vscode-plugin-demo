// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { TextDecoder } from "util";
import { simpleGit } from "simple-git";
import path = require("path");
import { readFileSync } from "fs";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "guess" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("guess.helloWorld", () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage("Hello World from guess!");

    const panel = vscode.window.createWebviewPanel(
      "test",
      "HelloWorld",
      {
        viewColumn: vscode.ViewColumn.Active,
      },
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    const html = readFileSync(
      path.join(context.extensionPath, "./src/webview.html"),
      "utf8"
    );
    panel.webview.html = html;

    const git = simpleGit({
      baseDir: vscode.workspace.rootPath,
    });

    git.status().then(({ current }) => {
      if (current) {
        panel.webview.postMessage({
          gitBranch: current.replace(/origin\//, ""),
        });
      }
    });

    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 0: {
            // checkout bugfix branch
            vscode.window
              .showInputBox({
                placeHolder: "请输入 bug id",
              })
              .then((value) => {
                if (typeof value !== "string") {
                  return;
                }
                if (!value || !/^[0-9]*$/.test(value)) {
                  vscode.window.showErrorMessage("bug ID 校验失败");
                  return;
                }

                const git = simpleGit({
                  baseDir: vscode.workspace.rootPath,
                });

                git.status().then((status) => {
                  if (status.files.length || status.staged.length) {
                    vscode.window.showErrorMessage(
                      "当前分支存在修改内容，请先保存"
                    );
                    return;
                  }

                  const { current } = status;
                  const [product, type, version] = current?.split(/\/|_/) || [];
                  if (type === "test") {
                    git
                      .checkoutBranch(
                        `${product}/fix_${version}_${value}`,
                        current!
                      )
                      .then(() => {
                        panel.webview.postMessage({
                          gitBranch: `${product}/fix_${version}_${value}`,
                        });
                      });
                  }
                });
              });

            break;
          }
          case 1: {
            // checkout test branch and make PR
            git.status().then((status) => {
              if (status.files.length || status.staged.length) {
                vscode.window.showErrorMessage(
                  "当前分支存在修改内容，请先保存"
                );
                return;
              }

              const { current } = status;
              if (!current) {
                return;
              }
              const [product, type, version] = current?.split(/\/|_/) || [];
              if (type === "fix") {
                vscode.window
                  .showInformationMessage("创建 PR", "创建")
                  .then(() => {
                    git.remote(["-v"]).then((remotes) => {
                      if (!remotes) {
                        return;
                      }
                      const remote = remotes
                        .split("\n")
                        .find(
                          (i) => i.endsWith("(push)") && i.startsWith("origin")
                        );
                      if (!remote) return;
                      const http = `http://${remote.match(/@(.+?):/)?.[1]}/${
                        remote.match(/\d+\/(.+?)(.git)/)?.[1]
                      }/merge_requests/new?merge_request[source_branch]=`;
                      const URI = vscode.Uri.parse(
                        http +
                          encodeURIComponent(current) +
                          "&merge_request[target_branch]=" +
                          encodeURIComponent(`${product}/test_${version}`)
                      );
                      vscode.env.openExternal(URI);
                    });
                  });
                git.checkout(`${product}/test_${version}`).then(() => {
                  panel.webview.postMessage({
                    gitBranch: `${product}/test_${version}`,
                  });
                });
              }
            });

            break;
          }

          default:
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);

  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  statusBar.command = "guess.helloWorld";
  statusBar.text = "$(calendar)";
  statusBar.tooltip = "Guess Your Sprint";
  statusBar.show();
}

// This method is called when your extension is deactivated
export function deactivate() {}
