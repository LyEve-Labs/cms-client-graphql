import type { HttpClient } from "@lyeve-labs/client";

// Types

export interface GraphQLResponse<T = unknown> {
  data: T | null;
  errors?: {
    message: string;
    locations?: { line: number; column: number }[];
    path?: string[];
  }[];
}

export interface GraphQLClientConfig {
  httpClient: HttpClient;
  /** Base URL for the GraphQL endpoint. Default: '' (relative path /api/v1/graphql). */
  baseUrl?: string;
  /** Auth token for WebSocket subscriptions. */
  token?: string;
}

export interface SubscriptionHandlers<T = unknown> {
  onData: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
}

export interface SubscriptionHandle {
  unsubscribe: () => void;
}

// Client

export class GraphQLClient {
  #config: GraphQLClientConfig;
  #httpClient: HttpClient;
  #baseUrl: string;

  constructor(config: GraphQLClientConfig) {
    this.#config = config;
    this.#httpClient = config.httpClient;
    this.#baseUrl = config.baseUrl ?? "";
  }

  /** Execute a GraphQL query via POST /api/v1/graphql. */
  async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    return this.#httpClient.post<GraphQLResponse<T>>(
      `${this.#baseUrl}/api/v1/graphql`,
      { query, variables },
    );
  }

  /** Execute a GraphQL mutation via POST /api/v1/graphql. */
  async mutate<T = unknown>(
    mutation: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    return this.#httpClient.post<GraphQLResponse<T>>(
      `${this.#baseUrl}/api/v1/graphql`,
      { query: mutation, variables },
    );
  }

  /**
   * Subscribe to a GraphQL subscription over WebSocket (graphql-ws protocol).
   * Connects to ws://host/api/v1/graphql/ws.
   *
   * The ws URL is derived from the baseUrl. For http://localhost:3001,
   * the WebSocket connects to ws://localhost:3001/api/v1/graphql/ws.
   */
  subscribe<T = unknown>(
    subscription: string,
    variables: Record<string, unknown> | undefined,
    handlers: SubscriptionHandlers<T>,
  ): SubscriptionHandle {
    const wsUrl = this.#baseUrl.replace(/^http/, "ws") + "/api/v1/graphql/ws";

    const ws = new WebSocket(wsUrl, "graphql-transport-ws");
    let unsubscribed = false;

    ws.onopen = () => {
      const payload = this.#config.token
        ? { authorization: `Bearer ${this.#config.token}` }
        : {};
      ws.send(JSON.stringify({ type: "connection_init", payload }));
      let subId: string | null = null;

      ws.onmessage = (e: MessageEvent) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "connection_ack") {
          subId =
            (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
            `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
          ws.send(
            JSON.stringify({
              id: subId,
              type: "subscribe",
              payload: { query: subscription, variables: variables ?? {} },
            }),
          );
          return;
        }
        if (!subId || msg.id !== subId) return;
        if (msg.type === "next" && !unsubscribed)
          handlers.onData(msg.payload.data as T);
        else if (msg.type === "error" && !unsubscribed)
          handlers.onError?.(new Error(JSON.stringify(msg.payload)));
        else if (msg.type === "complete") {
          if (!unsubscribed) handlers.onComplete?.();
          unsubscribed = true;
          ws.close();
        }
      };
    };

    ws.onerror = (e: Event) => {
      if (!unsubscribed) {
        handlers.onError?.(new Error("WebSocket error"));
      }
    };

    return {
      unsubscribe: () => {
        unsubscribed = true;
        ws.close();
      },
    };
  }
}

/** Create a GraphQL client backed by an existing HttpClient. */
export function createGraphQLClient(
  config: GraphQLClientConfig,
): GraphQLClient {
  return new GraphQLClient(config);
}
