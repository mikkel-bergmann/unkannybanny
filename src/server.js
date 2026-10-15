import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createApp } from "./app.js";
import { createStore } from "./store.js";

export async function startServer({ port = process.env.PORT || 4321, store } = {}) {
  const app = createApp({ store });
  return new Promise((resolve, reject) => {
    const server = app.listen(Number(port), "127.0.0.1");
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  const server = await startServer({ store: createStore() });
  console.log(`banny listening on http://127.0.0.1:${server.address().port}/`);
}
