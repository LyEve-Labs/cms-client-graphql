import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, ApiError } from "@lyeve-labs/client";
import { createGraphQLClient, GraphQLClient } from "../src/client.js";
import type { GraphQLResponse } from "../src/client.js";

// helpers

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(make: () => Response) {
  return vi.fn(async (_url: string, _init: RequestInit): Promise<Response> =>
    make(),
  );
}

// GraphQLClient

describe("GraphQLClient", () => {
  describe("constructor", () => {
    it("creates a GraphQLClient instance via factory", () => {
      const fetchFn = stubFetch(() => jsonResponse({}));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      expect(client).toBeInstanceOf(GraphQLClient);
    });

    it("defaults baseUrl to empty string", async () => {
      const fetchFn = stubFetch(() => jsonResponse({ data: { ok: true } }));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      await client.query("{ ok }");

      const [url] = fetchFn.mock.calls[0];
      expect(url).toBe("/api/v1/graphql");
    });
  });

  // query()

  describe("query()", () => {
    it("sends POST to /api/v1/graphql with query and variables", async () => {
      const fetchFn = stubFetch(() => jsonResponse({ data: null }));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const q = "{ viewer { id } }";
      const vars = { id: "1" };
      await client.query(q, vars);

      const [url, init] = fetchFn.mock.calls[0];
      expect(url).toBe("/api/v1/graphql");
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ query: q, variables: vars }));
    });

    it("returns the parsed GraphQLResponse", async () => {
      const response: GraphQLResponse<{ viewer: { id: string } }> = {
        data: { viewer: { id: "abc" } },
      };
      const fetchFn = stubFetch(() => jsonResponse(response));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const result = await client.query<{ viewer: { id: string } }>(
        "{ viewer { id } }",
      );

      expect(result).toEqual(response);
      expect(result.data?.viewer.id).toBe("abc");
    });

    it("works without variables (undefined)", async () => {
      const fetchFn = stubFetch(() => jsonResponse({ data: { ping: true } }));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const result = await client.query("{ ping }");

      expect(result.data).toEqual({ ping: true });

      // variables: undefined is passed through; JSON.stringify strips it
      const [_, init] = fetchFn.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.query).toBe("{ ping }");
      expect(body).not.toHaveProperty("variables");
    });

    it("propagates HTTP errors as ApiError", async () => {
      const fetchFn = stubFetch(() =>
        jsonResponse({ error: "rate limited" }, 429),
      );
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const err = await client.query("{ fail }").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(429);
        expect(err.message).toBe("rate limited");
        expect(err.name).toBe("ApiError");
      }
    });

    it("propagates 5xx errors as ApiError", async () => {
      const fetchFn = stubFetch(() =>
        jsonResponse("Internal Server Error", 502),
      );
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const err = await client.query("{ fail }").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(502);
      }
    });

    it("works with custom baseUrl", async () => {
      const fetchFn = stubFetch(() => jsonResponse({ data: { ok: true } }));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({
        httpClient,
        baseUrl: "http://localhost:3004",
      });

      await client.query("{ ok }");

      const [url] = fetchFn.mock.calls[0];
      expect(url).toBe("http://localhost:3004/api/v1/graphql");
    });
  });

  // mutate()

  describe("mutate()", () => {
    it("sends POST to /api/v1/graphql with query: mutation and variables", async () => {
      const fetchFn = stubFetch(() =>
        jsonResponse({ data: { createItem: { id: "1" } } }),
      );
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const mutation =
        "mutation CreateItem($input: ItemInput!) { createItem(input: $input) { id } }";
      const vars = { input: { name: "test" } };
      await client.mutate(mutation, vars);

      const [url, init] = fetchFn.mock.calls[0];
      expect(url).toBe("/api/v1/graphql");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      // mutate sends { query: mutation, variables } - not { mutation, variables }
      expect(body.query).toBe(mutation);
      expect(body.variables).toEqual(vars);
    });

    it("returns the parsed GraphQLResponse", async () => {
      const response: GraphQLResponse<{ createItem: { id: string } }> = {
        data: { createItem: { id: "new-1" } },
      };
      const fetchFn = stubFetch(() => jsonResponse(response));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const result = await client.mutate<{ createItem: { id: string } }>(
        "mutation { createItem { id } }",
      );

      expect(result).toEqual(response);
      expect(result.data?.createItem.id).toBe("new-1");
    });

    it("works without variables (undefined)", async () => {
      const fetchFn = stubFetch(() => jsonResponse({ data: { ok: true } }));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const result = await client.mutate("mutation { ok }");

      expect(result.data).toEqual({ ok: true });

      const [_, init] = fetchFn.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.query).toBe("mutation { ok }");
      expect(body).not.toHaveProperty("variables");
    });

    it("propagates HTTP errors as ApiError", async () => {
      const fetchFn = stubFetch(() =>
        jsonResponse({ error: "bad request" }, 400),
      );
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({ httpClient });

      const err = await client
        .mutate("mutation { fail }")
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(400);
        expect(err.message).toBe("bad request");
      }
    });

    it("works with custom baseUrl", async () => {
      const fetchFn = stubFetch(() => jsonResponse({ data: { ok: true } }));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({
        httpClient,
        baseUrl: "http://localhost:3004",
      });

      await client.mutate("mutation { ok }");

      const [url] = fetchFn.mock.calls[0];
      expect(url).toBe("http://localhost:3004/api/v1/graphql");
    });
  });

  // subscribe() - WebSocket graphql-ws protocol

  describe("subscribe()", () => {
    let originalWS: typeof WebSocket;
    let wsInstances: Array<{
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      url: string;
      protocol: string;
      triggerOpen: () => void;
      triggerMessage: (data: unknown) => void;
      triggerError: () => void;
    }> = [];

    beforeEach(() => {
      originalWS = globalThis.WebSocket;
      wsInstances = [];

      // Mock WebSocket with synchronous control
      globalThis.WebSocket = vi.fn(function (
        this: Record<string, unknown>,
        url: string,
        protocol?: string,
      ) {
        const send = vi.fn();
        const close = vi.fn();
        let onopen: (() => void) | null = null;
        let onmessage: ((e: MessageEvent) => void) | null = null;
        let onerror: ((e: Event) => void) | null = null;
        let onclose: ((e: CloseEvent) => void) | null = null;

        // Use getters/setters so the client can assign callbacks
        Object.defineProperties(this, {
          url: { value: url, enumerable: true },
          protocol: { value: protocol ?? "", enumerable: true },
          send: { value: send, enumerable: true },
          close: { value: close, enumerable: true },
          onopen: {
            get: () => onopen,
            set: (v: typeof onopen) => {
              onopen = v;
            },
            enumerable: true,
          },
          onmessage: {
            get: () => onmessage,
            set: (v: typeof onmessage) => {
              onmessage = v;
            },
            enumerable: true,
          },
          onerror: {
            get: () => onerror,
            set: (v: typeof onerror) => {
              onerror = v;
            },
            enumerable: true,
          },
          onclose: {
            get: () => onclose,
            set: (v: typeof onclose) => {
              onclose = v;
            },
            enumerable: true,
          },
        });

        wsInstances.push({
          send,
          close,
          url,
          protocol: protocol ?? "",
          triggerOpen: () => onopen?.(),
          triggerMessage: (data: unknown) =>
            onmessage?.(
              new MessageEvent("message", { data: JSON.stringify(data) }),
            ),
          triggerError: () => onerror?.(new Event("error")),
        });

        return this;
      } as unknown as typeof WebSocket);
    });

    afterEach(() => {
      globalThis.WebSocket = originalWS;
    });

    function makeClient() {
      const fetchFn = stubFetch(() => jsonResponse({}));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      return createGraphQLClient({ httpClient });
    }

    it("connects with correct URL and graphql-transport-ws protocol", () => {
      const client = makeClient();
      client.subscribe("subscription { x }", undefined, { onData: () => {} });
      expect(globalThis.WebSocket).toHaveBeenCalledWith(
        "/api/v1/graphql/ws",
        "graphql-transport-ws",
      );
    });

    it("derives ws:// URL from http:// baseUrl", () => {
      const fetchFn = stubFetch(() => jsonResponse({}));
      const httpClient = createClient(fetchFn as unknown as typeof fetch);
      const client = createGraphQLClient({
        httpClient,
        baseUrl: "http://localhost:3001",
      });
      client.subscribe("subscription { x }", undefined, { onData: () => {} });
      expect(globalThis.WebSocket).toHaveBeenCalledWith(
        "ws://localhost:3001/api/v1/graphql/ws",
        "graphql-transport-ws",
      );
    });

    it("sends connection_init on open, then subscribe after connection_ack", () => {
      const client = makeClient();
      client.subscribe(
        "subscription { posts { id } }",
        { filter: "x" },
        { onData: () => {} },
      );

      const ws = wsInstances[0];
      // Trigger open
      ws.triggerOpen();

      // Should have sent connection_init
      expect(ws.send).toHaveBeenNthCalledWith(
        1,
        JSON.stringify({ type: "connection_init", payload: {} }),
      );

      // Simulate server sending connection_ack
      ws.triggerMessage({ type: "connection_ack" });

      // Should have sent subscribe with correct payload
      expect(ws.send.mock.calls.length).toBe(2);
      const subMsg = JSON.parse(ws.send.mock.calls[1][0]);
      expect(subMsg.type).toBe("subscribe");
      expect(subMsg.id).toBeTruthy();
      expect(subMsg.payload.query).toBe("subscription { posts { id } }");
      expect(subMsg.payload.variables).toEqual({ filter: "x" });
    });

    it("sends empty variables object when variables is undefined", () => {
      const client = makeClient();
      client.subscribe("subscription { x }", undefined, { onData: () => {} });
      const ws = wsInstances[0];
      ws.triggerOpen();
      ws.triggerMessage({ type: "connection_ack" });

      const subMsg = JSON.parse(ws.send.mock.calls[1][0]);
      expect(subMsg.payload.variables).toEqual({});
    });

    it('calls onData when receiving "next" messages', () => {
      const client = makeClient();
      const onData = vi.fn();
      client.subscribe("subscription { x }", undefined, { onData });

      const ws = wsInstances[0];
      ws.triggerOpen();
      ws.triggerMessage({ type: "connection_ack" });
      const subId = JSON.parse(ws.send.mock.calls[1][0]).id;

      ws.triggerMessage({
        id: subId,
        type: "next",
        payload: { data: { posts: [{ id: "1", title: "Hello" }] } },
      });

      expect(onData).toHaveBeenCalledWith({
        posts: [{ id: "1", title: "Hello" }],
      });
    });

    it('calls onError when receiving "error" messages', () => {
      const client = makeClient();
      const onError = vi.fn();
      client.subscribe("subscription { x }", undefined, {
        onData: () => {},
        onError,
      });

      const ws = wsInstances[0];
      ws.triggerOpen();
      ws.triggerMessage({ type: "connection_ack" });
      const subId = JSON.parse(ws.send.mock.calls[1][0]).id;

      ws.triggerMessage({
        id: subId,
        type: "error",
        payload: [{ message: "unauthorized" }],
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toContain("unauthorized");
    });

    it('calls onComplete and closes WS on "complete"', () => {
      const client = makeClient();
      const onComplete = vi.fn();
      client.subscribe("subscription { x }", undefined, {
        onData: () => {},
        onComplete,
      });

      const ws = wsInstances[0];
      ws.triggerOpen();
      ws.triggerMessage({ type: "connection_ack" });
      const subId = JSON.parse(ws.send.mock.calls[1][0]).id;

      ws.triggerMessage({ id: subId, type: "complete" });

      expect(onComplete).toHaveBeenCalled();
      expect(ws.close).toHaveBeenCalled();
    });

    it("stops calling handlers after unsubscribe", () => {
      const client = makeClient();
      const onData = vi.fn();
      const sub = client.subscribe("subscription { x }", undefined, { onData });

      const ws = wsInstances[0];
      ws.triggerOpen();
      ws.triggerMessage({ type: "connection_ack" });
      const subId = JSON.parse(ws.send.mock.calls[1][0]).id;

      sub.unsubscribe();
      expect(ws.close).toHaveBeenCalled();

      // Messages after unsubscribe are ignored
      ws.triggerMessage({
        id: subId,
        type: "next",
        payload: { data: "stale" },
      });
      expect(onData).not.toHaveBeenCalled();
    });

    it("calls onError on WebSocket transport error", () => {
      const client = makeClient();
      const onError = vi.fn();
      client.subscribe("subscription { x }", undefined, {
        onData: () => {},
        onError,
      });

      const ws = wsInstances[0];
      ws.triggerError();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toBe("WebSocket error");
    });

    it("ignores messages for other subscription IDs", () => {
      const client = makeClient();
      const onData = vi.fn();
      client.subscribe("subscription { x }", undefined, { onData });

      const ws = wsInstances[0];
      ws.triggerOpen();
      ws.triggerMessage({ type: "connection_ack" });

      // Message with wrong id - should be ignored
      ws.triggerMessage({
        id: "wrong-id",
        type: "next",
        payload: { data: "nope" },
      });
      expect(onData).not.toHaveBeenCalled();
    });
  });
});
