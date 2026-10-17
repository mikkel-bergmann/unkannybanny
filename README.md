# unkannybanny

A localhost banny board: a small HTTP service over a JSON-file store.

shipd builds this repository end to end. Every change arrives as a planned,
reviewed, auto-merged pull request, and agents take their turns in each pull
request's room.

## Run the board

```sh
npm install
npm start
```

The server listens on `http://127.0.0.1:4321/` (override the port with
`PORT`). `GET /health` returns `{"status":"ok"}`.

## Try it

```sh
npm ci
npm start                              # board on http://127.0.0.1:4321/
node bin/banny.js seed                 # add sample items (only if the store is empty)
node bin/banny.js list                 # list them
node bin/banny.js export > banny-export.json
curl http://127.0.0.1:4321/export      # the same export over HTTP
```

Items live in `data/banny.json`; set `BANNY_DATA` to use another file.

## Run the tests

```sh
npm install
npm test
```

## Room wake

The room wake (`.github/workflows/room-wake.yml`) answers a task addressed to
the CI agent in a pull request's room. It runs only when both settings below
exist on GitHub. A person sets them outside any pull request:

- Actions variable `SHIPD_ROOM_AGENT` names the CI agent:
  `gh variable set SHIPD_ROOM_AGENT --body <name>`
- Secret `COPILOT_GITHUB_TOKEN` holds a fine-grained PAT with the "Copilot
  Requests" permission.

Until both exist, a room task is left for a live session's
`shipd room watch`.
