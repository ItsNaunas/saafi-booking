import { ImageResponse } from "next/og";
import { site, contact } from "@/lib/business";

// Generated rather than a static file, so it can never drift from the brand and
// there is no asset to lose. This is the picture that shows in WhatsApp, which
// is where this business actually shares links — without it the link renders as
// a grey box.
//
// No custom font: satori reads ttf/otf/woff, and both project faces ship as
// woff2 only. The system stack is the honest trade rather than shipping a
// second copy of Cabinet Grotesk purely for this route.

export const alt = `${site.name} — family-run home cleaning with a price you see before you book`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#0d2a48",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 44,
              backgroundColor: "#52aaef",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "0.06em",
              display: "flex",
            }}
          >
            SAAFI CLEANING
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 940,
              display: "flex",
            }}
          >
            A spotless home, without lifting a finger
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 32,
              color: "#b6dcfb",
              maxWidth: 820,
              display: "flex",
            }}
          >
            Family-run home cleaning with a price you see before you book.
            Get yours online in under a minute.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.18)",
            paddingTop: 26,
            fontSize: 26,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <div style={{ display: "flex" }}>saaficleaningservice.com</div>
          <div style={{ display: "flex" }}>{contact.phoneDisplay}</div>
        </div>
      </div>
    ),
    size,
  );
}
