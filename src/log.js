import { randomUUID } from "node:crypto";

const ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function requestLogger({
  write = (line) => process.stdout.write(line + "\n"),
} = {}) {
  return function requestLogger(req, res, next) {
    const time = new Date();
    const start = process.hrtime.bigint();
    const incoming = req.get("X-Request-Id");
    const id = incoming && ID_PATTERN.test(incoming) ? incoming : randomUUID();
    req.id = id;
    res.set("X-Request-Id", id);

    let logged = false;
    const done = () => {
      if (logged) return;
      logged = true;
      const ms = Number((process.hrtime.bigint() - start) / 1000000n);
      const entry = {
        time: time.toISOString(),
        id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms,
      };
      if (res.locals.error) entry.error = res.locals.error;
      write(JSON.stringify(entry));
    };
    res.on("finish", done);
    res.on("close", done);
    next();
  };
}

export function noRoute(req, res) {
  res.status(404).json({
    error: { code: "no-route", message: `No route for ${req.method} ${req.path}` },
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err?.status ?? err?.statusCode;
  if (
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 499 &&
    typeof err.code === "string" &&
    CODE_PATTERN.test(err.code)
  ) {
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  res.locals.error = err?.message ?? String(err);
  res.status(500).json({
    error: { code: "internal", message: "Internal server error" },
  });
}
