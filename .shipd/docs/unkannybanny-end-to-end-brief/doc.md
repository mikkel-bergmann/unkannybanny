# unkannybanny end-to-end brief

## The request

Run an end-to-end test of shipd on a fresh repository. Create a new repo
called `unkannybanny`: a localhost service with a JSON-store database. Plan
the whole thing as an epic with at least eight member changes and pull
requests, so the agent communications on each pull request get exercised.

## Decisions taken with the user

- The repository lives at `https://github.com/mikkel-bergmann/unkannybanny`
  (the `shipd-now` organisation refused the create) and is registered as the
  workspace project `unkannybanny`.
- The app is a banny board: a localhost HTTP service over a JSON-file store
  serving items with create, read, update and delete, tags, search, a health
  endpoint, a CLI, seed and export verbs, and one static HTML page.
- The stack is Node with Express and a JSON-file store.
- Protections mirror shipd: a ruleset on `main` requires a pull request, the
  `ci` and `semantic-review` status checks, and resolved review threads;
  auto-merge and squash merge are on; the review gate and the room wake are
  installed.

## Bootstrap already on main

- `package.json` with `npm test` running `node --test`, one smoke test, a
  `ci` workflow on Node 22, the shipd content layout, and themes
  `banny-board`, `platform`, `developer-experience`.
