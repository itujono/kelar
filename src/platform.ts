import { platform } from "node:os";

const isMacOS = platform() === "darwin";
const isWindows = platform() === "win32";

export function openUrl(url: string): void {
  if (isWindows) {
    Bun.spawn(["cmd", "/c", "start", url]);
  } else if (isMacOS) {
    Bun.spawn(["open", url]);
  } else {
    Bun.spawn(["xdg-open", url]);
  }
}

export function copyToClipboard(text: string): void {
  if (isWindows) {
    Bun.spawn(["clip"], { stdin: Buffer.from(text) });
  } else if (isMacOS) {
    Bun.spawn(["pbcopy"], { stdin: Buffer.from(text) });
  } else {
    Bun.spawn(["xclip", "-selection", "clipboard"], { stdin: Buffer.from(text) });
  }
}
