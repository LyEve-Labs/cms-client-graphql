# @lyeve/cms-client-graphql

GraphQL client for LyEve CMS; queries, mutations, and subscriptions over WebSocket.

Depends on `@lyeve/cms-client` for the HTTP client layer.

## Install

```sh
pnpm add @lyeve/cms-client @lyeve/cms-client-graphql
```

## Usage

```ts
import { createClient } from '@lyeve/cms-client';
import { createGraphQLClient } from '@lyeve/cms-client-graphql';

const http = createClient(fetch, { Authorization: 'Bearer <token>' });
const gql = createGraphQLClient({ httpClient: http });

// Query
const { data, errors } = await gql.query(`{ schemas { name fields { name type } } }`);

// Mutate
const { data } = await gql.mutate(`mutation { createSchema(name: "reviews") { id } }`);

// Subscribe (graphql-ws protocol)
const sub = gql.subscribe(`subscription { contentChanged { schema record_id } }`, {}, {
  onData: (ev) => console.log('change:', ev),
  onError: (err) => console.error(err),
});
// Later: sub.unsubscribe();
```

## API

| Method | Description |
|--------|-------------|
| `query<T>(query, variables?)` | Execute a GraphQL query via POST /api/v1/graphql |
| `mutate<T>(mutation, variables?)` | Execute a GraphQL mutation via POST /api/v1/graphql |
| `subscribe<T>(subscription, variables, handlers)` | Subscribe over WebSocket (graphql-transport-ws). Returns `{ unsubscribe }` |

- `baseUrl` configures the endpoint (default: relative `/api/v1/graphql`).

## License

MIT
