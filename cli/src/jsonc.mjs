export function stripJsonComments(text) {
  let result = "";
  let index = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (index < text.length) {
    const character = text[index];
    const next = text[index + 1];

    if (inLineComment) {
      if (character === "\n") {
        inLineComment = false;
        result += character;
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (character === "*" && next === "/") {
        inBlockComment = false;
        index += 2;
        continue;
      }
      if (character === "\n") result += character;
      index += 1;
      continue;
    }

    if (inString) {
      result += character;
      if (character === "\\") {
        result += next ?? "";
        index += 2;
        continue;
      }
      if (character === '"') inString = false;
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      index += 1;
      continue;
    }

    if (character === "/" && next === "/") {
      inLineComment = true;
      index += 2;
      continue;
    }

    if (character === "/" && next === "*") {
      inBlockComment = true;
      index += 2;
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}

export function stripTrailingCommas(text) {
  let result = "";
  let index = 0;
  let inString = false;

  while (index < text.length) {
    const character = text[index];

    if (inString) {
      result += character;
      if (character === "\\") {
        result += text[index + 1] ?? "";
        index += 2;
        continue;
      }
      if (character === '"') inString = false;
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      index += 1;
      continue;
    }

    if (character === ",") {
      const rest = text.slice(index + 1);
      const nextMeaningful = rest.match(/^\s*([\]}])/);
      if (nextMeaningful) {
        index += 1;
        continue;
      }
    }

    result += character;
    index += 1;
  }

  return result;
}

export function parseJsonc(text) {
  return JSON.parse(stripTrailingCommas(stripJsonComments(text)));
}
