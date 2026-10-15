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

## Run the tests

```sh
npm install
npm test
```
