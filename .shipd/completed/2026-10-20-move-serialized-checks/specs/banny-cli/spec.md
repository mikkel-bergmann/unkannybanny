## MODIFIED Requirements

### Requirement: Column verbs
id: cli-columns
base: 535100feb02f

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
