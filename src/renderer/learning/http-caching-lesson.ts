/**
 * Original introductory lesson written for Headroom. Facts follow RFC 9111
 * (HTTP Caching); section numbers are cited in the text and in LESSON_SOURCES.
 */
export const LESSON_TITLE = 'HTTP caching: reusing responses safely';

export const LESSON_TEXT = `HTTP caching: reusing responses safely

A cache keeps a copy of an HTTP response so that a later request can be answered without asking the origin server again. Reusing a response saves network round trips, reduces load on the server, and often makes pages feel instant. The rules for doing this safely are defined in RFC 9111, "HTTP Caching".

There are two broad kinds of cache. A private cache serves a single user; the cache inside your web browser is the usual example. A shared cache stores responses for many users; reverse proxies and content delivery networks are common examples (RFC 9111, Section 1). The distinction matters because a response containing one person's data must never be handed to someone else.

A cache looks up stored responses by a cache key. At minimum the key is the request method and the target URI (RFC 9111, Section 2). If a response varies by request headers, the server lists those headers in the Vary field, and the cache must also match them before reusing the response (Section 4.1). For example, "Vary: Accept-Language" stops an English page from being served to someone who asked for French.

A stored response is either fresh or stale. It is fresh while its age is less than its freshness lifetime (Section 4.2). The Age header reports how long a response has already spent in caches. A fresh response can be reused without contacting the server.

Servers usually state the freshness lifetime explicitly. "Cache-Control: max-age=600" means the response stays fresh for 600 seconds (Section 5.2.2.1). The s-maxage directive sets a separate lifetime that applies only to shared caches (Section 5.2.2.10). The older Expires header gives an absolute date instead; when max-age is present, it takes precedence over Expires (Section 4.2.1).

When a response has no explicit lifetime, a cache is allowed in some cases to estimate one. This is called heuristic freshness. A common approach uses a fraction of the time since the Last-Modified date, and RFC 9111 mentions 10% as a typical fraction (Section 4.2.2). Relying on heuristics makes behavior harder to predict, which is one reason servers are encouraged to send explicit directives.

A stale response is not thrown away automatically. Instead, the cache can validate it by sending a conditional request to the server (Section 4.3). If the stored response has an ETag, the cache sends If-None-Match with that tag; if it has a Last-Modified date, it can send If-Modified-Since. When nothing has changed, the server replies "304 Not Modified" without a body, and the cache refreshes its stored copy and reuses it (Section 4.3.4). Validation costs a round trip but avoids downloading the full response again.

Several Cache-Control directives restrict what caches may do. "no-store" means a cache must not store the request or the response at all (Section 5.2.2.5). "no-cache" does not prevent storage; it means the stored response must not be reused without first validating it with the server (Section 5.2.2.4). The two are easy to confuse, so it helps to read "no-cache" as "check with the server before every reuse".

The "private" directive tells shared caches not to store a response, while still letting the user's own private cache keep it (Section 5.2.2.7). This is appropriate for pages showing account details. The "must-revalidate" directive says that once the response becomes stale, a cache must not use it without successful validation (Section 5.2.2.2).

Putting this together, a sensible policy for a versioned script file might be "Cache-Control: max-age=31536000" because its URL changes whenever its content changes. A personalized dashboard might use "Cache-Control: private, no-cache" so the browser can keep a copy but checks with the server before showing it. A response containing a one-time secret would use "no-store".
`;

export interface ComprehensionQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly answerId: string;
  readonly rationale: string;
}

export const COMPREHENSION_CHECK: readonly ComprehensionQuestion[] = [
  {
    id: 'q1',
    prompt: 'What does "Cache-Control: no-cache" on a response mean?',
    options: [
      { id: 'a', label: 'The response must never be stored.' },
      { id: 'b', label: 'The response may be stored but must be validated before each reuse.' },
      { id: 'c', label: 'Only shared caches may store the response.' },
    ],
    answerId: 'b',
    rationale:
      '"no-cache" allows storage but forbids reuse without validation (RFC 9111, Section 5.2.2.4). Forbidding storage is "no-store".',
  },
  {
    id: 'q2',
    prompt: 'A cached response is stale and has an ETag. What can the cache do before reusing it?',
    options: [
      {
        id: 'a',
        label:
          'Send a conditional request with If-None-Match and reuse the copy if the server replies 304.',
      },
      { id: 'b', label: 'Nothing; stale responses must always be discarded.' },
      { id: 'c', label: 'Increase max-age and serve it as fresh.' },
    ],
    answerId: 'a',
    rationale:
      'Validation with If-None-Match lets the server answer "304 Not Modified" so the stored copy can be refreshed and reused (Section 4.3).',
  },
  {
    id: 'q3',
    prompt:
      'Which directive keeps a response out of shared caches while allowing the browser cache to store it?',
    options: [
      { id: 'a', label: 'public' },
      { id: 'b', label: 'private' },
      { id: 'c', label: 's-maxage=0' },
    ],
    answerId: 'b',
    rationale:
      '"private" tells shared caches not to store the response; a private cache may still store it (Section 5.2.2.7).',
  },
  {
    id: 'q4',
    prompt: 'Why does a server send "Vary: Accept-Language"?',
    options: [
      { id: 'a', label: 'To make the response expire faster.' },
      { id: 'b', label: 'So caches match the request language before reusing a stored response.' },
      { id: 'c', label: 'To prevent the response from being cached.' },
    ],
    answerId: 'b',
    rationale:
      'Vary adds the listed request headers to what must match before reuse (Section 4.1).',
  },
];

export const LESSON_SOURCES: readonly { readonly label: string; readonly url: string }[] = [
  {
    label: 'RFC 9111: HTTP Caching (IETF, June 2022)',
    url: 'https://www.rfc-editor.org/rfc/rfc9111.html',
  },
  {
    label: 'RFC 9110: HTTP Semantics, conditional requests (IETF, June 2022)',
    url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
  },
  {
    label: 'MDN Web Docs: HTTP caching',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching',
  },
];
