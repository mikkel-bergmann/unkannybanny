## ADDED Requirements

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

When a user runs `banny move <item-id> <column-id>`, the system SHALL set the
item's `columnId` to that column and print the item's list line; with `--none`
it SHALL set `columnId` to `null` instead and take no column id. A missing item
or column SHALL exit `4` naming it. If `validateItemPatch` throws
`ItemValidationError`, then the system SHALL exit `3` with the error's message
and SHALL NOT change the store.

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

#### Scenario: Unassign an item
- **WHEN** the board holds item `milk` in column `c` and a user runs
  `banny move <milk> --none`
- **THEN** the exit code is `0` and the data file holds `milk` with `columnId`
  `null`

#### Scenario: Unknown ids
- **WHEN** a user runs `banny column remove no-such-id`, then
  `banny move no-such-item <c>`
- **THEN** each exits `4` and names the id
