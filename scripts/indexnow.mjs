// Ping IndexNow with every URL in the LIVE sitemap. Run after a production
// deploy that adds or changes public pages:  npm run indexnow
// Plain .mjs (no build step) so it runs with bare node. Key must match
// src/lib/indexnow.ts and public/<key>.txt.
const SITE = "https://saaficleaningservice.com";
const KEY = "519a173f7ee81aedac617bc8c571de08";

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error("No URLs found in the live sitemap — nothing sent.");
  process.exit(1);
}

const keyCheck = await fetch(`${SITE}/${KEY}.txt`);
if (!keyCheck.ok || (await keyCheck.text()).trim() !== KEY) {
  console.error(`Key file ${SITE}/${KEY}.txt isn't live — deploy first.`);
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE).host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: ${res.status} for ${urls.length} URLs`);
// 200/202 are both success (202 = key still being validated on first use).
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
