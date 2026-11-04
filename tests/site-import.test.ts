import { describe, expect, it } from "vitest";
import { findDates, isPrivateAddress, readEventPage } from "@/lib/site-import";

const NOW = new Date("2026-11-04T10:00:00Z");

describe("adding an event from its website", () => {
  it("finds dates written in the usual ways", () => {
    expect(findDates("7TH & 8TH NOVEMBER 2026 SAVE THE DATE!", NOW)).toEqual({ startDay: "2026-11-07", endDay: "2026-11-08" });
    expect(findDates("Held on the 13th and 14th of November 2026 at Landmark", NOW)).toEqual({ startDay: "2026-11-13", endDay: "2026-11-14" });
    expect(findDates("17 to 22 Nov 2026 · Lagos", NOW)).toEqual({ startDay: "2026-11-17", endDay: "2026-11-22" });
    expect(findDates("Join us Nov 13–14, 2026", NOW)).toEqual({ startDay: "2026-11-13", endDay: "2026-11-14" });
    expect(findDates("Saturday, 7 November 2026, 12 PM", NOW)).toEqual({ startDay: "2026-11-07", endDay: "2026-11-07" });
    expect(findDates("December 5, 2026", NOW)).toEqual({ startDay: "2026-12-05", endDay: "2026-12-05" });
    expect(findDates("30 October – 2 November 2026", NOW)).toEqual({ startDay: "2026-10-30", endDay: "2026-11-02" });
    // Past years (e.g. "© 2019" or last year's recap) are skipped.
    expect(findDates("Last year: 9 November 2025. This year: 7 November 2026.", NOW)).toEqual({ startDay: "2026-11-07", endDay: "2026-11-07" });
    expect(findDates("No dates here", NOW)).toBeNull();
  });

  it("reads a page's share tags, text and logo", () => {
    const html = `<html><head><title>Ignored</title>
      <meta content="GTCO Fashion Weekend | Guaranty Trust Bank" property="og:title"/>
      <meta content="Get a glimpse of the latest in Nigerian &amp; African fashion. More text here." property="og:description"/>
      <meta name="theme-color" content="#E04000"><meta name="twitter:site" content="@gtbank">
      </head><body><img src="/img/fw-logo.png" alt="gtco fashion weekend logo"><h2>7TH &amp; 8TH NOVEMBER 2026</h2><p>Venue: GTCentre, Victoria Island, Lagos</p>
      <script>var x = "1 January 2030";</script></body></html>`;
    expect(readEventPage(html, "https://fashionweekend.gtcoplc.com/", NOW)).toMatchObject({
      name: "GTCO Fashion Weekend",
      organiser: "Guaranty Trust Bank",
      tagline: "Get a glimpse of the latest in Nigerian & African fashion.",
      startDay: "2026-11-07",
      endDay: "2026-11-08",
      venue: "GTCentre, Victoria Island, Lagos",
      logo: "https://fashionweekend.gtcoplc.com/img/fw-logo.png",
      brandColor: "#e04000",
      xHandle: "gtbank",
    });
  });

  it("prefers schema.org Event data when the page has it", () => {
    const ld = { "@context": "https://schema.org", "@graph": [{ "@type": "Organization", name: "X" }, { "@type": "BusinessEvent", name: "Lagos Product Summit", startDate: "2027-03-10T09:00:00+01:00", endDate: "2027-03-11", location: { "@type": "Place", name: "Landmark Centre", address: { streetAddress: "Water Corporation Rd", addressLocality: "Lagos" } }, organizer: { name: "PM Hub" }, description: "Two days for product people. Free." }] };
    const html = `<head><meta property="og:title" content="Something else"><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>1 June 2027</body>`;
    expect(readEventPage(html, "https://summit.example.com/", NOW)).toMatchObject({ name: "Lagos Product Summit", organiser: "PM Hub", startDay: "2027-03-10", endDay: "2027-03-11", venue: "Landmark Centre, Water Corporation Rd, Lagos", tagline: "Two days for product people." });
  });

  it("only fetches public websites", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["104.18.1.1", "8.8.8.8", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("adding an event from its website: details", () => {
  it("reads dashes written as HTML entities, skips one-word title tails, and doesn't repeat venue parts", () => {
    const html = `<title>Big Summit 2026 | Lagos</title><body><p>17&ndash;22 November 2026 · Lagos</p><script type="application/ld+json">{"@type":"Event","name":"Big Summit 2026","location":{"name":"Lagos, Nigeria","address":"Lagos"}}</script></body>`;
    expect(readEventPage(html, "https://bigsummit.example.com/", new Date("2026-11-04"))).toMatchObject({ startDay: "2026-11-17", endDay: "2026-11-22", organiser: null, venue: "Lagos, Nigeria" });
  });
});
