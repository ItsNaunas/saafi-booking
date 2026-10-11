import { site } from "@/lib/business";

/**
 * IndexNow: tells Bing (and through it Yahoo, DuckDuckGo, Ecosia, Copilot and
 * ChatGPT search, plus Yandex) that URLs are new or changed, so they're
 * crawled in hours rather than whenever Bing next looks. Google does not use
 * IndexNow — for Google, the sitemap and Search Console still do the work.
 *
 * The key is public by design: search engines confirm ownership by fetching
 * /<key>.txt from the site, which is public/519a173f7ee81aedac617bc8c571de08.txt.
 * Changing the key means replacing that file in the same commit.
 */
export const INDEXNOW_KEY = "519a173f7ee81aedac617bc8c571de08";

/** Best-effort: a failed ping costs nothing but a slower crawl. */
export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status: number }> {
  if (urls.length === 0) return { ok: true, status: 0 };
  const host = new URL(site.url).host;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${site.url}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });
  // 200 = accepted, 202 = accepted, key validation pending (normal on first use).
  return { ok: res.status === 200 || res.status === 202, status: res.status };
}
