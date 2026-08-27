"use client";

// Two hidden fields that carry the device's position into the start/finish
// action, plus the sentence telling the cleaner it happens.
//
// Deliberately a stamp, not a track (2026-08-25 review, scoped): one fix when
// the job starts, one when it ends, nothing in between. That gives SAAFI the
// thing they actually asked for — proof the cleaner was at the property —
// without continuous staff tracking and the consent weight that carries.
//
// Permission denied, no GPS, http instead of https: the fields stay empty and
// the job buttons work exactly as before. Location is evidence, never a gate —
// a cleaner must always be able to start the job.

import { useEffect, useState } from "react";

export default function LocationStamp({ prefix }: { prefix: "started" | "finished" }) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<"asking" | "on" | "off">("asking");

  useEffect(() => {
    let gone = false;
    const fail = () => {
      if (!gone) setState("off");
    };
    if (!("geolocation" in navigator)) {
      // Deferred so the effect body itself sets no state — same cascading-
      // render rule the rest of the codebase follows.
      const t = setTimeout(fail, 0);
      return () => {
        gone = true;
        clearTimeout(t);
      };
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (gone) return;
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setState("on");
      },
      fail,
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
    return () => {
      gone = true;
    };
  }, []);

  return (
    <>
      {pos && (
        <>
          <input type="hidden" name={`${prefix}_lat`} value={pos.lat} />
          <input type="hidden" name={`${prefix}_lng`} value={pos.lng} />
        </>
      )}
      <p className="mt-2 text-xs text-slate-400">
        {state === "on" && "Your location is recorded when you tap — start and finish only, never in between."}
        {state === "asking" && "Checking location — you can tap without waiting."}
        {state === "off" && "Location off — the button works anyway."}
      </p>
    </>
  );
}
