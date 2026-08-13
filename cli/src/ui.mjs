import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const useColour = stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColour ? `[${code}m${text}[0m` : text);

export const bold = (text) => paint("1", text);
export const dim = (text) => paint("2", text);
export const green = (text) => paint("32", text);
export const yellow = (text) => paint("33", text);
export const red = (text) => paint("31", text);

export function step(message) {
  console.log(`${bold("::")} ${message}`);
}

export function ok(message) {
  console.log(`  ${green("ok")}   ${message}`);
}

export function warn(message) {
  console.log(`  ${yellow("warn")} ${message}`);
}

export function fail(message) {
  console.log(`  ${red("fail")} ${message}`);
}

export function note(message) {
  console.log(`  ${dim(message)}`);
}

export async function confirm(question, assumeYes) {
  if (assumeYes) return true;
  if (!stdin.isTTY) return false;
  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(`${question} [y/N] `);
  prompt.close();
  return ["y", "yes"].includes(answer.trim().toLowerCase());
}

export class UserFacingError extends Error {}
