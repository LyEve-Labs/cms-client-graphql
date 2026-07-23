# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.1.0] - 2026-07-23

### Added

- Initial release.
- `createGraphQLClient` factory that builds a typed GraphQL client on top of the core `HttpClient`.
- Support for GraphQL queries, mutations, and subscriptions over WebSocket transport.
- Generic `GraphQLResponse<T>` type for typed response handling and error extraction.
- Subscription lifecycle management with `SubscriptionHandlers` callbacks and `SubscriptionHandle` for teardown.