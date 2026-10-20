# banny-cli

### Requirement: CLI entry point and verb dispatch
id: cli-dispatch

The system SHALL provide `bin/banny.js`, an executable ES module starting with
`#!/usr/bin/env node`, declared in `package.json` as `"bin": {"banny":
"bin/banny.js"}`. The module SHALL export `main(argv, io)` that resolves to an
exit code and SHALL run it only when the file is the entry point, comparing
`import.meta.url` with the realpath of `process.argv[1]` so the guard holds
when invoked through an npm bin symlink. Verbs SHALL be looked up in one
exported `commands` table keyed by verb name, so a later member adds a verb by
adding an entry. The verb SHALL be the first argument that does not start with
`-`, and the global flags `--json` and `--help` SHALL be accepted anywhere in
the arguments. The CLI SHALL build its store with json-store's `createStore()`,
so the data file comes from `BANNY_DATA` (default `data/banny.json`), and SHALL
NOT start or call the HTTP server.

#### Scenario: Help prints usage
- **WHEN** a user runs `node bin/banny.js --help`
- **THEN** stdout names the verbs `list`, `add`, `done`, and `remove`, and the
  exit code is `0`

#### Scenario: Usage errors exit 2
- **WHEN** a user runs `node bin/banny.js` with no arguments, then with the
  verb `frobnicate`, then `list --nope`
- **THEN** each run writes a message to stderr, writes nothing to stdout, and
  exits `2`

#### Scenario: Importing the module runs nothing
- **WHEN** a test imports `bin/banny.js`
- **THEN** no verb runs, and the first four keys of `commands` are `list`,
  `add`, `done`, and `remove`; a later member may add more

#### Scenario: Entry guard holds through a symlink
- **WHEN** a test runs `bin/banny.js list` through a symlink in a temp
  directory, with `BANNY_DATA` naming a file holding one item
- **THEN** stdout shows that item and the exit code is `0`

### Requirement: List verb
id: cli-list

When a user runs `banny list`, the system SHALL print every item in store
order, one line per item, as `<id>  [x] <title>` for a done item and
`<id>  [ ] <title>` otherwise, followed, when the item has tags, by two spaces
and the tags as `#<tag>` separated by one space, and SHALL print nothing for an
empty store. `list` SHALL take no positional argument.

#### Scenario: List shows items and done marks
- **WHEN** the store holds an open item `milk` tagged `shop` and a done item
  `bread`, and a user runs `banny list`
- **THEN** stdout is the two lines `<id1>  [ ] milk  #shop` and
  `<id2>  [x] bread`, and the exit code is `0`

#### Scenario: Empty store lists nothing
- **WHEN** `BANNY_DATA` names a file that does not exist and a user runs
  `banny list`
- **THEN** stdout is empty, the exit code is `0`, and the file still does not
  exist

### Requirement: Add verb
id: cli-add

When a user runs `banny add <words...> [--tag <tag>]...`, the system SHALL
join the positional words after the verb with one space as the title, collect
every `--tag` value in order, pass `{ title, tags }` through items-api's
`validateNewItem`, create the item with the store, and print its list line.
If no title word is given, then the system SHALL treat it as a usage error. If
`validateNewItem` throws `ItemValidationError`, then the system SHALL exit `3`
with the error's message and SHALL NOT change the store.

#### Scenario: Add an item with tags
- **WHEN** a user runs `banny add buy milk --tag shop --tag home`
- **THEN** the exit code is `0`, stdout is `<id>  [ ] buy milk  #shop #home`,
  and the data file holds that item with `done: false`

#### Scenario: Invalid item is refused
- **WHEN** a user runs `banny add milk --tag "Bad Tag"`, then `banny add`
  with a 201-character title
- **THEN** each run exits `3`, stderr names the fault, and the store is
  unchanged

#### Scenario: Missing title is a usage error
- **WHEN** a user runs `banny add --tag shop`
- **THEN** the exit code is `2` and the store is unchanged

### Requirement: Done verb
id: cli-done

When a user runs `banny done <id>`, the system SHALL set the item's `done` to
`true` through items-api's `validateItemPatch` and the store's `update`, and
print the item's list line; an item already done SHALL stay done and exit `0`.
Where `--undo` is given, the system SHALL set `done` to `false` instead. The
id SHALL match an item's full id exactly. If no item has that id, then the
system SHALL exit `4`. If the number of positional ids is not exactly one,
then the system SHALL treat it as a usage error.

#### Scenario: Mark done and undo
- **WHEN** a user runs `banny done <id>` twice on an open item, then
  `banny done <id> --undo`
- **THEN** the first two runs exit `0` and print `<id>  [x] <title>`, and the
  third exits `0`, prints `<id>  [ ] <title>`, and the file holds
  `done: false`

#### Scenario: Unknown or partial id
- **WHEN** a user runs `banny done no-such-id`, then `banny done` with the
  first eight characters of an existing id
- **THEN** each run exits `4` with a message on stderr and the store is
  unchanged

### Requirement: Remove verb
id: cli-remove

When a user runs `banny remove <id>`, the system SHALL delete the item whose
full id matches exactly and print `removed <id>`. If no item has that id, then
the system SHALL exit `4`. If the number of positional ids is not exactly one,
then the system SHALL treat it as a usage error.

#### Scenario: Remove an item
- **WHEN** a user runs `banny remove <id>` on an existing item, then
  `banny remove <id>` again
- **THEN** the first run exits `0`, prints `removed <id>`, and the item is gone
  from the file; the second exits `4`

### Requirement: JSON output flag
id: cli-json

Where `--json` is given, the system SHALL write exactly one JSON document and
a newline to stdout on success: `list` SHALL print `{"items":[...]}`, `add`
and `done` SHALL print the item object, and `remove` SHALL print
`{"id":"<id>","removed":true}`. On failure under `--json`, the system SHALL
write nothing to stdout and SHALL write
`{"error":{"code":"<code>","message":"<text>"}}` to stderr, using the codes
`usage`, `invalid-item`, `not-found`, `store-corrupt`, and `internal`.

#### Scenario: JSON success documents
- **WHEN** a user runs `banny add milk --json`, `banny list --json`,
  `banny --json done <id>`, and `banny remove <id> --json`
- **THEN** each stdout parses as JSON: the added item with `title` `milk`,
  `{"items":[<that item>]}`, the item with `done: true`, and
  `{"id":"<id>","removed":true}`

#### Scenario: JSON error document
- **WHEN** a user runs `banny done no-such-id --json`
- **THEN** stdout is empty, stderr parses as
  `{"error":{"code":"not-found","message":<string>}}`, and the exit code is
  `4`

### Requirement: Exit codes
id: cli-exit-codes

The CLI SHALL exit `0` on success, `2` on a usage error (no verb, an unknown
verb, an unknown flag, a missing flag value, or a wrong number of positional
arguments), `3` on an invalid item, `4` on an unknown id, and `1` on any other
failure. If the store rejects with code `store-corrupt`, then the system SHALL
exit `1` with the store's message and error code `store-corrupt`; any other
unexpected error SHALL exit `1` with error code `internal`. In human mode
every error SHALL be written to stderr as one line `banny: <message>`.

#### Scenario: Corrupt store exits 1
- **WHEN** `BANNY_DATA` names a file holding `not json` and a user runs
  `banny list --json`
- **THEN** the exit code is `1`, stderr parses with `error.code`
  `store-corrupt`, and the file still holds `not json`

#### Scenario: Human error line
- **WHEN** a user runs `banny remove no-such-id`
- **THEN** stderr is one line starting `banny: `, stdout is empty, and the exit
  code is `4`

### Requirement: Column verbs
id: cli-columns

The `commands` table SHALL hold the verbs `columns`, `column`, and `move`.

When a user runs `banny columns`, the system SHALL print every column in store
order, one line per column as `<id>  <name>`, and SHALL print nothing for a
board with no columns.

When a user runs `banny column add <name...>`, the system SHALL join the
positional words after `add` with one space, pass `{ name }` through
`validateNewColumn`, create the column, and print its line.

When a user runs `banny column rename <id> <name...>`, the system SHALL set the
column's name through `validateColumnPatch` and print its line, or exit `4`
naming the id when no column has it.

When a user runs `banny column move <id> <position>`, the system SHALL move the
column to that 1-based position among the columns and print the resulting order,
one line per column; a position outside 1 to the column count SHALL be a usage
error.

When a user runs `banny column remove <id>`, the system SHALL remove the column,
unassigning its items, and print `removed <id>`, or exit `4` naming the id when
no column has it.

When a user runs `banny move <item-id> <column-id>`, the system SHALL move the
item into that column through the store's `moveItem`, placing it at the end of
the lane, and print the item's list line; with `--none` it SHALL move the item
into the unassigned lane instead and take no column id. Where
`--before <item-id>` is given, the system SHALL place the item immediately
before that item instead of at the end, so the verb also reorders a card within
its own lane. The verb SHALL NOT read the store before `moveItem`; it SHALL map
the store's `ItemReferenceError` reasons instead, so every check holds against
the state the move writes. A missing column, item, or `--before` item SHALL
exit `4` naming it, checked in that order ("no column with id <id>", then
"no item with id <id>"). If the `--before` item is the moved item itself or
sits in a different lane than the target, then the system SHALL exit `3` with
"--before must not be the moved item" or "--before names an item in another
lane" and SHALL NOT change the store.

#### Scenario: List and add columns
- **WHEN** the board is empty and a user runs `banny columns`, then
  `banny column add Doing`
- **THEN** the first prints nothing and exits `0`, and the second prints
  `<id>  Doing` and the data file holds that column

#### Scenario: Move a column
- **WHEN** the board holds columns `a` then `b` and a user runs
  `banny column move <b> 1`
- **THEN** the exit code is `0` and `banny columns` prints `b` before `a`

#### Scenario: Move an item into a column
- **WHEN** the board holds column `c` and item `milk` and a user runs
  `banny move <milk> <c>`
- **THEN** the exit code is `0`, stdout is the item's list line, and the data
  file holds `milk` with `columnId` `c`

#### Scenario: Reorder an item with --before
- **WHEN** column `c` holds `milk` then `bread` and a user runs
  `banny move <bread> <c> --before <milk>`
- **THEN** the exit code is `0` and `banny list` prints `bread` before `milk`

#### Scenario: Moving into a lane appends
- **WHEN** column `c` holds `milk`, `eggs` was created earlier with no column,
  and a user runs `banny move <eggs> <c>`
- **THEN** the exit code is `0` and the data file's `items` array holds `milk`
  before `eggs`

#### Scenario: Unassign an item
- **WHEN** the board holds item `milk` in column `c` and a user runs
  `banny move <milk> --none`
- **THEN** the exit code is `0` and the data file holds `milk` with `columnId`
  `null`

#### Scenario: Bad --before is refused
- **WHEN** a user runs `banny move <milk> <c> --before <milk>`, then
  `banny move <milk> <c> --before <an item in another lane>`, then
  `banny move <milk> <c> --before no-such-item`
- **THEN** the first two exit `3`, the third exits `4`, and the data file is
  unchanged

#### Scenario: Unknown ids
- **WHEN** a user runs `banny column remove no-such-id`, then
  `banny move no-such-item <c>`
- **THEN** each exits `4` and names the id

#### Scenario: A --before item deleted during the move is refused
- **WHEN** `main` runs `move <x> <c> --before <a>` with a store wrapped so
  `moveItem` first starts `remove(<a>)`
- **THEN** the exit code is `4`, stderr names `<a>`, and `x` keeps `columnId`
  `null`
