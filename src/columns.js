export class ColumnValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ColumnValidationError";
    this.code = "invalid-column";
  }
}

const KEYS = ["name"];

function checkObject(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ColumnValidationError("column must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (!KEYS.includes(key)) throw new ColumnValidationError(`unknown field: ${key}`);
  }
}

function checkName(name) {
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
    throw new ColumnValidationError("name must be a string of 1 to 100 characters");
  }
}

export function validateNewColumn(input) {
  checkObject(input);
  if (!("name" in input)) throw new ColumnValidationError("name is required");
  checkName(input.name);
  return { name: input.name.trim() };
}

export function validateColumnPatch(input) {
  checkObject(input);
  if (!("name" in input)) throw new ColumnValidationError("patch must set name");
  checkName(input.name);
  return { name: input.name.trim() };
}
