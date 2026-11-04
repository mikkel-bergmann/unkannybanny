# stats

### Requirement: Stats counts
id: stats-counts

The system SHALL export from `src/routes/stats.js` the function
`computeStats(items, columns = [])` returning an object with the keys `total`,
`done`, `open`, `tags`, `columns`, and `unassigned`, in that order. `total`,
`done`, `open`, and `tags` SHALL keep their meaning: the item count, the items
with `done` true, the rest, and the distinct tag count. `columns` SHALL be an
array holding one `{ id, name, count }` per entry of `columns`, in the order
given, where `count` is the number of items whose `columnId` equals that `id`.
`unassigned` SHALL be the number of items whose `columnId` is `null`, absent,
or names no column, so that `unassigned` plus every `count` equals `total`.

#### Scenario: Cards counted per column in board order
- **WHEN** columns `Backlog` then `Doing` exist, two items sit in `Doing`, one
  in `Backlog`, and one has `columnId` `null`
- **THEN** `computeStats` returns `columns` as `Backlog` count 1 then `Doing`
  count 2, and `unassigned` 1

#### Scenario: Empty column and dangling reference
- **WHEN** a column holds no item and one item's `columnId` names no column
- **THEN** that column's `count` is 0 and the item adds to `unassigned`

### Requirement: Stats route
id: stats-route

When a client sends `GET /stats`, the system SHALL answer `200` with the object
`computeStats` returns over `store.list()` and `store.listColumns()`. If the
store fails to read, then the system SHALL answer `500` through the app error
handler.

#### Scenario: Seeded board
- **WHEN** a client sends `GET /stats` over a store with columns `Backlog` and
  `Doing` and three items, one in `Doing`
- **THEN** the body carries `columns` of `Backlog` 0 and `Doing` 1, and
  `unassigned` 2

#### Scenario: Empty store
- **WHEN** a client sends `GET /stats` over an empty store
- **THEN** the body is `total` 0, `done` 0, `open` 0, `tags` 0, `columns` `[]`,
  and `unassigned` 0

### Requirement: Stats verb
id: stats-verb

When a user runs `banny stats`, the system SHALL print `total`, `done`, `open`,
and `tags` as `<key>: <n>` lines, then one line `column <name>: <n>` per column
in board order, then `unassigned: <n>`. When a user runs `banny stats --json`,
the system SHALL print the same object `GET /stats` answers, on one compact
line. A positional argument SHALL remain a usage error.

#### Scenario: Text output with columns
- **WHEN** a user runs `banny stats` over columns `Backlog` and `Doing` with one
  item in `Doing` and two unassigned
- **THEN** stdout ends with `column Backlog: 0`, `column Doing: 1`, and
  `unassigned: 2` on separate lines

#### Scenario: JSON equals the route
- **WHEN** a user runs `banny stats --json` over a seeded board
- **THEN** the parsed stdout deep-equals the `GET /stats` body
