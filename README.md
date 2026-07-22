# @lyeve-labs/client-graphql

GraphQL client for LyEve Core. Queries, mutations, and subscriptions over
WebSocket.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org)

```bash
pnpm add @lyeve-labs/client @lyeve-labs/client-graphql
```

```ts
import { createClient } from "@lyeve-labs/client";
import { createGraphQLClient } from "@lyeve-labs/client-graphql";

const http = createClient(fetch, { Authorization: "Bearer <token>" });
const gql = createGraphQLClient({ httpClient: http });

const { data } = await gql.query(`{ schemas { name fields { name type } } }`);
```

Query, mutate, subscribe. One client, all three operations.

---

## What's in the box

- **Queries:** typed `query<T>(query, variables?)` over HTTP POST.
- **Mutations:** typed `mutate<T>(mutation, variables?)` over HTTP POST.
- **Subscriptions:** `subscribe<T>(query, variables, handlers)` over WebSocket
  using the `graphql-transport-ws` protocol.
- **Thin layer:** delegates HTTP to `@lyeve-labs/client` so auth, error handling,
  and retry just work.

## Requirements

- **Node 20** or newer
- **[@lyeve-labs/client](https://www.npmjs.com/package/@lyeve-labs/client)** `>=0.1.0`

## Install

```bash
pnpm add @lyeve-labs/client @lyeve-labs/client-graphql
# or npm install @lyeve-labs/client @lyeve-labs/client-graphql
# or yarn add @lyeve-labs/client @lyeve-labs/client-graphql
```

## Use

```ts
import { createClient } from "@lyeve-labs/client";
import { createGraphQLClient } from "@lyeve-labs/client-graphql";

const http = createClient(fetch, { Authorization: "Bearer <token>" });
const gql = createGraphQLClient({ httpClient: http });

// Query
const { data, errors } = await gql.query<{ schemas: Schema[] }>(
  `{ schemas { name fields { name type } } }`,
);

// Mutation
const { data } = await gql.mutate<{ createSchema: { id: string } }>(
  `mutation { createSchema(name: "reviews") { id } }`,
);

// Subscription
const sub = gql.subscribe(
  `subscription { contentChanged { schema record_id } }`,
  {},
  {
    onData: (ev) => console.log("change:", ev),
    onError: (err) => console.error(err),
  },
);
// Later: sub.unsubscribe();
```

## API

| Method                                            | Description                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `query<T>(query, variables?)`                     | GraphQL query via `POST /api/v1/graphql`                                     |
| `mutate<T>(mutation, variables?)`                 | GraphQL mutation via `POST /api/v1/graphql`                                  |
| `subscribe<T>(subscription, variables, handlers)` | Subscribe over WebSocket (`graphql-transport-ws`). Returns `{ unsubscribe }` |

`baseUrl` in the config overrides the endpoint (default: relative `/api/v1/graphql`).

## Local development

```bash
pnpm install            # install dependencies
pnpm test               # run unit tests
pnpm check              # type-check
pnpm build              # tsup + publint -> dist/
```

## Project layout

```
src/
  client.ts          # createGraphQLClient
  index.ts           # public API
tests/               # vitest test suite
```

## Versioning

`@lyeve-labs/client-graphql` follows [SemVer](https://semver.org). While under `1.0`,
breaking changes bump the **minor** version; additive changes bump the **patch**.
Every release is logged in [`CHANGELOG.md`](CHANGELOG.md).

## Contributing

Bug reports and feature requests are welcome. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the development setup and conventions.

## License

MIT. See [`LICENSE`](LICENSE).
