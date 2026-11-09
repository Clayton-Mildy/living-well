# Round 21: monthly field trips, pick-up by distance, Where from map, contact ratings

Date: 10 Nov 2026 · Branch `round21` (cut from main 5d2e0bb) · Asked by KC for the owner

## Why

The owner wants four things before go-live:

1. **Field trips** are paid monthly, not per trip joined. CitraPremier holds one trip a month. Members who take part pay its fee on the monthly invoice, and a paid month they miss is credited on the next invoice. A trip needs a proper venue record.
2. **Pick-up** is priced by distance: Rp 10,000 per km from the club, free close to Citra Garden.
3. **Where from**: an Insights map and table of where members and enquiries live.
4. **Contact ratings**: staff log 1–5 star ratings of suppliers and services, so the better AC service is easy to pick.

The Living Well look (fonts and colours) and the gold splash are **not** in this round. After the four features are built, a design canvas shows the new look for the dashboard and the family app (with the splash already chosen on 9 Nov, option 3) for KC to choose from.

## Answers KC gave (10 Nov)

| Question | Answer |
|---|---|
| Who pays the monthly field trip fee | Only members switched on (an on/off on the member, like pick-up) |
| Pick-up per km is charged | Per month, on the monthly invoice |
| Rounding | Up to the next whole km (6.4 km → 7 km → Rp 70,000) |
| Free near Citra Garden | Free within a radius set in Settings (2 km) |
| How a location is set | Free OpenStreetMap map: search the address, drag the pin |
| Trip venue details | Saved as a Contacts entry, picked on the trip form |
| Venue images | Several per venue, staff only |
| Who rates contacts | Staff who can edit Contacts; family never see ratings |
| Area map | Circles sized by count (no boundary files) |

## 1. Locations (shared by pick-up and the map)

**Data.** A new `GeoPoint { lat: number; lng: number; kelurahan?: string; kecamatan?: string; city?: string }`.

- `Member.location?: GeoPoint`, next to the existing `address` text.
- `Enquiry.address?: string` and `Enquiry.location?: GeoPoint` (both optional).
- `DirectoryContact.address?: string` and `DirectoryContact.location?: GeoPoint`.
- `ClubSettings.location?: GeoPoint`, the club's own pin. The seed sets it at Citra Garden, Kalideres.

**Location picker** (one web component, used everywhere a location is set):

- An address box with a **Search** button. Searching runs on Enter or the button, never on each keystroke, because the free search service forbids type-ahead. Up to 5 results show. Picking one moves the pin.
- A Leaflet map (OpenStreetMap tiles, about 220 px tall on a phone) with a draggable pin and the club's star.
- Dropping or dragging the pin fills kelurahan, kecamatan and city from a reverse lookup. Staff can still type over them; suggestions come from values already used in the club.
- If the map or search is unreachable, the address text and the area fields still save. Only the pin is missing.

**Server proxy.** `GET /api/geo/search?q=` and `GET /api/geo/reverse?lat=&lng=` call Nominatim with the app's own User-Agent. They allow at most 1 request a second, cache answers for a day, and limit search to Indonesia. With `CP_GEO_FAKE=1` (unit and e2e tests) they answer from a small fixed list around Citra Garden, so tests never go online.

**Where a location is set:**

- **Member:** registration (Add member), Edit details and the bulk import (later). It goes through `members.updateDetails` as a new `location` field, so a front-desk change waits for review like an address change does.
- **Enquiry:** the lead form (new and edit), as optional address and location fields in `enquiry.create` / `enquiry.update`. When a lead joins (`enquiry.convert`), its address and location carry over to the new member. The online registration link keeps its address text; staff set the pin.
- **Contacts:** the contact form, for any kind (useful for venues and suppliers).
- **Club:** Settings › Pick-up.

## 2. Pick-up by distance

**Settings › Pick-up** (management): the club location, **price per km** (default Rp 10,000) and **free within** (default 2 km). Stored as `ClubSettings.pickupRate?: { perKm: number; freeKm: number }` and saved by `club.updateSettings`. Changing the price per km or the free distance is a price change, so it waits for the Owner, like the other prices do (owner gate kind `pricing`). The club location applies at once.

**The price** (`rules/geo.ts`):

- `distanceKm(a, b)`: straight-line (haversine) distance, to 0.1 km.
- `pickupPrice(s, m, date)` becomes:
  - pick-up off → `null`;
  - custom price → that price (as today);
  - no member pin or no club pin → `{ price: 0, needsLocation: true }`;
  - distance ≤ free km → `{ price: 0, km, free: true }`;
  - otherwise `{ price: ceil(km) × perKm, km }`.
- The invoice line reads "Pick-up · 6.4 km" and is worked out at each invoice run from the current pin and rate. A member who moves pays the new price from the next invoice.
- The flat pick-up price leaves the Plans price list (old versions keep the figure; nothing reads it). The pick-up switch still sits at registration and on the member (`members.setPickup`, finance and management). Switching it on needs a member pin or a custom price; without one it fails with "Set the location first".
- **Where it shows:** the member profile's pick-up row ("6.4 km · Rp 70,000 a month", "Free · 1.2 km" or "No location"), registration (live as the pin moves), the Members list row, the family's next bill.

## 3. Field trips paid monthly

**Switch.** `Member.fieldTrips?: { on: boolean }`, set at registration and by a new `members.setFieldTrips` (finance and management, like pick-up). There is a Members filter, "Field trips · n".

**Monthly fee.** The price list's existing `fieldTrip` figure (Rp 250,000) is now the monthly fee. Plans labels it "Field trips, a month". In `runLinesFor`, a member who is switched on, active on the issue date and not on leave that month gets a line `{ id: 'trip-<period>', kind: 'fieldTrip', label: 'inv.line.fieldTrips', params: { month }, refMonth: period }`. It is flat, not prorated, like pick-up.

**Credit for a missed month.** When billing period P, look at the month before (Q). If the member has a non-voided `trip-<Q>` line and is not in Who went of any non-cancelled outing in Q (including a month with no trip at all), add `{ id: 'tripCredit-<Q>', kind: 'fieldTrip', label: 'inv.line.tripCredit', amount: −(that line's amount), refMonth: Q }`. It is added only once, keyed by the billed line ids. A member who leaves gets that credit on their final invoice. Who went still fills itself at check-in on the trip day and can be edited in Calendar (round 20).

**Removed:** the per-trip fee box on the trip form, `CalendarEvent.fee` and the per-join pending charges in `setTripMember` / `syncTripRoster`. Charges already on old invoices stay as they are. Round 20's other rules stay: trip days count as visit days, and Flex extra days are still billed.

**Next bill preview** (`nextBill`): it shows the field trip fee and any trip credit beside pick-up.

## 4. Trip venues in Contacts

**Contact fields.** `DirectoryContact` gets `kind: 'venue'` (new) and these optional fields for every kind: `contactPerson`, `address`, `location`, `photoMediaIds: string[]` (up to 10). For a venue, the name is the trading name.

- A venue needs a trading name, address, contact person and contact number. Images are optional.
- Venues list under a fixed **Field trip venues** heading in Contacts (not one of the categories management edits). A venue's sheet shows its images (tap for full size, add or remove), the map pin and a **Trips here** list (date and event name).

**Trip form** (Calendar › New field trip and edit):

- Event name (and the Indonesian name, as today).
- A **venue** picker: a search over saved venues with a "+ New venue" option, which opens the venue form inside the trip form.
- Date or dates and times, as today. There is no fee box.
- Stored as `CalendarEvent.venueId`. A venue is required for a new field trip; older trips without one still open.

**Family.** In the family copy of the data, an outing carries only `venue: { name, address }`. Family never get the venue images, contact person, phone or ratings. Venues are not public contacts.

## 5. Contact ratings

- `DirectoryContact.ratings?: { id; stars: 1–5; note?: string (≤ 200); at; by }[]`.
- Actions: `directory.rate` (whoever can edit Contacts) and `directory.unrate` (your own rating; management can remove any).
- `ratingOf(c)` gives `{ avg (1 decimal), n }`. Within each heading, contacts sort by average (high first), then count, then name; unrated contacts go last.
- **Contacts row:** "★ 4.8 · 6" on the right, or nothing when unrated.
- **Contact sheet:** five tap stars, an optional note and **Add rating**. Below is the rating log (stars, note, name, date) with a delete on your own rows.
- The family copy drops `ratings`, `photoMediaIds`, `contactPerson` and `location` from public contacts.

## 6. Insights › Where from

A sixth Insights tab (EN "Where from", ID "Asal"), with access as Insights today.

- **Who:** Members, Enquiries, or Both (default Both). Members means active members today. Enquiries means leads created in the Insights period, archived ones left out (the period picker applies to enquiries only, and says so).
- **View:** Exact pins, Kelurahan or Kecamatan (default Kecamatan).
  - **Pins:** members as solid ink dots, enquiries as gold rings, the club as a star. Tapping a pin shows the name and opens the profile or lead.
  - **Kelurahan / Kecamatan:** one circle per area at the average of its pins. The size follows the square root of the count, with the number inside. With Both, the number is the total, and the table splits it.
- **Table under the map:**
  - In the area views: Area · Members · Enquiries, biggest first. Tap a row to get a sheet with its people (name, member or enquiry, km).
  - In the pins view: Name · Member or Enquiry · Kelurahan · Kecamatan · km, paginated.
  - On a phone, rows are dense list rows.
- "n without a location" opens the list of people missing a pin, each linking to where it is set.
- **Rules:** `rules/whereFrom.ts`: `wherePoints(s, who, period, today)` and `whereAreas(points, level)`, unit tested and with no map code.

## 7. Seed (demo data)

- **Club pin:** Citra Garden, Kalideres (about −6.136, 106.731), Rp 10,000 per km, free within 2 km.
- **Members:** all 45 move to West Jakarta and nearby Tangerang addresses with pins: Kalideres, Cengkareng, Kembangan, Grogol Petamburan and Kosambi. Most live within 8 km, a few further. The scripted five keep their stories. Tests that read the old Kemang addresses are updated. Supplier addresses on receipts are untouched.
- **Switches:** about a third of members have Field trips on; the existing pick-up member keeps pick-up with a pin about 6.4 km away (Rp 70,000).
- **Enquiries:** about 12 leads get addresses and pins.
- **Venues:** the seeded trips (Taman Mini, Kebun Raya Bogor, Batik museum) get venue contacts with images from the demo media. The past Taman Mini trip loses its fee. Members switched on who were not on it get the October credit on the next run.
- **Ratings:** two AC services, one rated about 4.8 from 6 ratings and one about 2.3 from 3. A few other contacts get one or two ratings.

## 8. Languages, roles, phone first

- Every new label in EN and ID.
- Who can do what follows today's rules:
  - pick-up and field trip switches: finance and management (the front desk at registration);
  - Settings: management, with the Owner gate on rates;
  - Contacts edit and rate: lobby, finance and management, through the Roles grid;
  - Insights: as today.
- Layout is phone first, dense rows, filters as dropdowns. Check it on phone, tablet and desktop.

## 9. Testing (kept lean)

- **Shared unit tests:**
  - `distanceKm` and pick-up price (free, round-up, custom, no location);
  - field trip line and credit (went, missed, no trip, leave month, voided invoice, final invoice);
  - `nextBill`, ratings sort and average, `whereAreas` grouping;
  - the family copy dropping venue and rating details;
  - lead to member location carry-over;
  - seed anchors.
- **Web:** a few component tests (location picker with the fake geo, contact rating, trip venue picker).
- **One e2e spec** (`e2e/round21.spec.ts`, phone): set a member pin → pick-up price shows; create a trip with a new venue; rate a contact; open Where from.
- Low CPU: one test runner at a time, vitest `--maxWorkers=2`, one e2e group, clean up e2e databases after.

## Build order

1. Geo: types, `distanceKm`, the server proxy with its fake mode, the location picker, the club pin in Settings.
2. Pick-up by distance (Settings rates, price rule, member and registration).
3. Contacts: venue fields, images, ratings.
4. Monthly field trips: switch, invoice line and credit, the trip form with the venue, family copy.
5. Insights › Where from.
6. Seed, the e2e spec, then a check on phone, tablet and desktop.

After merging: the Living Well design canvas (dashboard and family app, plus the chosen splash) for KC to choose from.

## Out of scope

- Road distance (Google Maps) and shaded area boundaries.
- Per-day pick-up records.
- Applying the new fonts and colours.
- Building the splash screen.
