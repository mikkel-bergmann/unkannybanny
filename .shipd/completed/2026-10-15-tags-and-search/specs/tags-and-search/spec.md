## ADDED Requirements

### Requirement: Filter the item list by tag and search text
id: items-filters

When a client sends `GET /items` with query parameters, the system SHALL answer
`200` with `{"items": [...]}` holding, in store order, only the items that
carry every tag named by a `tag` parameter (a single `tag` or repeated `tag`
parameters, matched exactly) and, when `q` is present and not empty after
trimming, whose `title` contains the trimmed `q` case-insensitively. The `tag`
and `q` filters SHALL combine with AND, an empty or whitespace-only `q` SHALL
apply no filter, and query keys other than `tag` and `q` SHALL be ignored.

#### Scenario: Repeated tags narrow the list
- **WHEN** the store holds `milk` tagged `["shop","food"]`, `bread` tagged
  `["shop"]`, and `call mum` tagged `[]`, and a client sends
  `GET /items?tag=shop` and then `GET /items?tag=shop&tag=food`
- **THEN** the first answers `200` with `milk` and `bread` in store order, and
  the second answers `200` with `milk` only

#### Scenario: Search is a case-insensitive title substring
- **WHEN** a client sends `GET /items?q=%20MIL%20`, then `GET /items?q=`, then
  `GET /items?q=br&tag=food` against the same store
- **THEN** the first answers with `milk` only, the second with all three items,
  and the third with `{"items": []}`

### Requirement: Malformed filters are refused
id: items-filters-invalid

If a `tag` value on `GET /items` is not a string matching
`^[a-z0-9]+(-[a-z0-9]+)*$`, or `q` is present but not a single string, then the
system SHALL answer `400` with
`{"error":{"code":"invalid-query","message":"<text>"}}`.

#### Scenario: Bad tag and repeated q are refused
- **WHEN** a client sends `GET /items?tag=Bad%20Tag`, `GET /items?tag=`,
  `GET /items?tag[x]=y`, and `GET /items?q=a&q=b`
- **THEN** each answers `400` with code `invalid-query`

### Requirement: Tag counts route
id: tags-route

The system SHALL export from `src/routes/tags.js` a default function
`(store) => Router` that `createApp` mounts directly after the items router.
When a client sends `GET /tags`, the system SHALL answer `200` with
`{"tags": [{"tag": "<name>", "count": <n>}, ...]}` holding one entry for each
tag carried by at least one item, where `count` is the number of items
carrying it, sorted by tag name in ascending string order, and SHALL answer
`{"tags": []}` when no item carries a tag.

#### Scenario: Counts over all items
- **WHEN** the store holds `milk` tagged `["shop","food"]`, `bread` tagged
  `["shop"]`, and `call mum` tagged `[]`, and a client sends `GET /tags`
- **THEN** the response is `200` with
  `{"tags":[{"tag":"food","count":1},{"tag":"shop","count":2}]}`

#### Scenario: Empty store
- **WHEN** a client sends `GET /tags` against an empty store
- **THEN** the response is `200` with `{"tags": []}`
