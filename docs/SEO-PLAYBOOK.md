# SAAFI — SEO playbook (2026-10-08)

The site side is done (titles, service pages, schema, sitemap, review asks).
Everything below is off-site and needs a human with SAAFI's logins.

## 1. The business details — copy EXACTLY, everywhere

Google cross-checks name, phone and website across the web. One variation
("Saafi Cleaning", a different number) weakens all of them.

```
Name:      SAAFI Cleaning Service
Phone:     07864 161387
Website:   https://saaficleaningservice.com
Email:     info@saaficleaningservice.com
Area:      Oxford & Oxfordshire (service-area business — address hidden)
Hours:     Mon–Sat 8am–6pm
Category:  House cleaning service
```

**Short description (≈150 chars)**
> Family-run home cleaning across Oxford & Oxfordshire. Regular, one-off and deep cleans — see your price online in under a minute.

**Long description (≈700 chars)**
> SAAFI Cleaning Service is a family-run home cleaning business covering Oxford and Oxfordshire — Kidlington, Abingdon, Witney, Bicester, Didcot, Wallingford, Thame and every OX postcode. We offer regular weekly or fortnightly cleans, one-off cleans and top-to-bottom deep cleans, including end of tenancy cleaning. Every clean covers the kitchen, bathrooms, hallways, landings and floors, and you see your price online before you book. We check who we hire, take up references, are insured for work in your home and train every cleaner before their first visit. Book online at saaficleaningservice.com or call 07864 161387.

**Links to use on profiles:** home page for general listings;
`/deep-cleaning` for anything about deep or end-of-tenancy cleaning.

## 2. Listings — in this order

| # | Where | Why | Done |
|---|---|---|---|
| 1 | Google Business Profile — business.google.com | Map results. The big one. | ☐ |
| 2 | Google Search Console — search.google.com/search-console | Indexing + search data. Send the HTML-tag code to set `GOOGLE_SITE_VERIFICATION`. | ☐ |
| 3 | Bing Webmaster Tools — bing.com/webmasters | Import from Search Console (one click). Feeds Bing, ChatGPT search, DuckDuckGo. | ☐ |
| 4 | Bing Places — bingplaces.com | Import from Google Business Profile once verified. | ☐ |
| 5 | Apple Business Connect — businessconnect.apple.com | Apple Maps + Siri ("cleaners near me" on iPhone). | ☐ |
| 6 | Facebook business page | Then send the URL — it goes on the site + schema. | ☐ |
| 7 | Nextdoor business page | Local recommendations. | ☐ |
| 8 | Yell — yell.com (free listing) | Strong UK directory. | ☐ |
| 9 | Thomson Local, FreeIndex, Cylex UK, Hotfrog UK, Scoot | Citations; 10 minutes each. | ☐ |
| 10 | Bark — bark.com | Also sends paid leads; optional. | ☐ |
| 11 | Checkatrade or TrustATrader | Vetted-trade badge; paid, optional. | ☐ |

Never buy "100 directory submissions" or link packages — Google penalises them.

## 3. Reviews

- Once the Business Profile is verified: **Home → "Ask for reviews"** → copy the
  link → set it in Vercel as `GOOGLE_REVIEW_URL` and redeploy. From then on the
  daily run asks every customer once, the morning after their first clean.
  (Paste `supabase/2026-10-08-review-requests.sql` in Supabase first.)
- Also send the link by hand to every past customer, once.
- Reply to every review, good or bad, within a few days.
- Never offer a discount for a review, never ask only happy customers, never
  write your own — all three break Google's rules and the DMCC Act.

## 4. Local links (worth more than every directory combined)

**Letting & estate agents** — end of tenancy cleans are steady work and a link
from their "recommended suppliers" page is a strong local signal.

> Subject: End of tenancy cleaning in Oxfordshire
>
> Hi [name],
>
> I run SAAFI Cleaning Service, a family-run cleaning business covering Oxford
> and Oxfordshire. We do end of tenancy and between-tenancy deep cleans —
> two cleaners, kitchen and oven always included, priced by the size of the
> property so you know the cost up front.
>
> If you keep a list of recommended cleaners for landlords or outgoing
> tenants, we'd love to be on it. Happy to do a first clean so you can see the
> standard.
>
> [name] · 07864 161387 · saaficleaningservice.com/deep-cleaning

Also: Oxfordshire Chamber of Commerce directory, parish/village newsletters
(Kidlington, Wolvercote, Botley, Headington), sponsoring a local junior
football club or school fair (most list sponsors with a link), Oxford Brookes
and university landlord/accommodation supplier lists.

## 5. Business Profile — weekly post ideas

One short post a week with a real photo:
- Before/after of a deep clean ("End of tenancy in Headington, done in a day").
- "This week we're in Witney, Abingdon and Kidlington — slots left Thursday."
- A tip: "How often should you deep clean an oven?"
- Meet the team (with permission).

## 6. Content (month 2+)

One or two posts a month, each answering a question people ask before hiring:
1. How much does a cleaner cost in Oxford? (use live prices)
2. Deep clean vs regular clean — which do you need?
3. End of tenancy cleaning checklist for Oxford renters
4. How often should you get a cleaner?
