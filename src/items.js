export class ItemValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ItemValidationError";
    this.code = "invalid-item";
  }
}

export class ItemReferenceError extends ItemValidationError {
  constructor(reason, ref, message) {
    super(message);
    this.name = "ItemReferenceError";
    this.reason = reason;
    this.ref = ref;
  }
}

const KEYS = ["title", "done", "tags", "columnId"];
const TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkObject(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ItemValidationError("item must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (!KEYS.includes(key)) throw new ItemValidationError(`unknown field: ${key}`);
  }
}

function checkTitle(title) {
  if (typeof title !== "string" || title.trim().length < 1 || title.trim().length > 200) {
    throw new ItemValidationError("title must be a string of 1 to 200 characters");
  }
}

function checkDone(done) {
  if (typeof done !== "boolean") throw new ItemValidationError("done must be a boolean");
}

function checkTags(tags) {
  if (!Array.isArray(tags)) throw new ItemValidationError("tags must be an array");
  if (tags.length > 10) throw new ItemValidationError("tags must hold at most 10 entries");
  for (const tag of tags) {
    if (typeof tag !== "string" || !TAG.test(tag)) {
      throw new ItemValidationError("tags entries must be lowercase letters, digits, and single hyphens");
    }
  }
  if (new Set(tags).size !== tags.length) {
    throw new ItemValidationError("tags must not contain duplicates");
  }
}

function checkColumnId(columnId) {
  if (columnId !== null && (typeof columnId !== "string" || columnId.length === 0)) {
    throw new ItemValidationError("columnId must be null or a non-empty string");
  }
}

function checkPresent(input) {
  if ("title" in input) checkTitle(input.title);
  if ("done" in input) checkDone(input.done);
  if ("tags" in input) checkTags(input.tags);
  if ("columnId" in input) checkColumnId(input.columnId);
}

export function validateNewItem(input) {
  checkObject(input);
  if (!("title" in input)) throw new ItemValidationError("title is required");
  checkPresent(input);
  const { title, done, tags, columnId } = input;
  return {
    title: title.trim(),
    done: done ?? false,
    tags: tags ? [...tags] : [],
    columnId: columnId ?? null,
  };
}

export function validateItemPatch(input) {
  checkObject(input);
  if (!KEYS.some((k) => k in input)) {
    throw new ItemValidationError("patch must set title, done, tags, or columnId");
  }
  checkPresent(input);
  const out = {};
  if ("title" in input) out.title = input.title.trim();
  if ("done" in input) out.done = input.done;
  if ("tags" in input) out.tags = [...input.tags];
  if ("columnId" in input) out.columnId = input.columnId;
  return out;
}

export function validateItemMove(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ItemValidationError("move must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (key !== "columnId" && key !== "before") {
      throw new ItemValidationError(`unknown field: ${key}`);
    }
  }
  if (!("columnId" in input)) throw new ItemValidationError("columnId is required");
  checkColumnId(input.columnId);
  if (input.before !== undefined && input.before !== null) {
    if (typeof input.before !== "string" || input.before.length === 0) {
      throw new ItemValidationError("before must be null or a non-empty string");
    }
  }
  return { columnId: input.columnId, before: input.before ?? null };
}
