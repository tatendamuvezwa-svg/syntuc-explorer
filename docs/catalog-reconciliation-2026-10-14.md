# Syntuc Explorer — Operator Catalog Reconciliation
**Prepared:** 14 October 2026  
**Branch:** `docs/operator-catalog-reconciliation-2026-10-14`  
**Purpose:** Reconcile supplied Wild Horizons and Shearwater price-list information without mixing operator ownership or overwriting existing records prematurely.

## 1. Non-negotiable catalog rules

1. **One product belongs to one operator record.** Every Wild Horizons item must reference the Wild Horizons operator ID; every Shearwater item must reference the Shearwater operator ID. Never infer ownership from a similar product name or price.
2. **Operator-specific offers stay separate.** If two operators sell a sunset cruise, helicopter flight, game drive, Falls tour, or package, create/retain separate records with distinct operator IDs, source references, and prices.
3. **Packages are products in their own right.** Do not replace a package with its included activities or merge it into another operator's similarly named package.
4. **Separate base price from mandatory fees.** Store the quoted base price, fee amount, fee type, fee currency, and whether the fee is included. Do not silently add a park/government/fuel/transfer fee to a base price.
5. **Source and confidence are required.** Preserve source name/date, validity window, and reconciliation status. Mark unverified entries as Draft/Needs Verification, not Published.
6. **No live Firestore changes are made by this document.** This is a reconciliation register for review and a controlled catalog update; it is not evidence that production records have been changed.

## 2. Source precedence and status

- **Shearwater:** The original file `2026 - Shearwater Pricelist (lnternational).pdf` is the controlling source for the values transcribed below where it conflicts with the user-provided summary. Some source text and fee labels still require direct operator confirmation.
- **Wild Horizons:** Values below are transcribed from the user-provided brochure summary. The original brochure was not independently inspected in this repository workflow; treat all proposed entries as **Draft / source verification required** before publication.
- **Existing catalog:** Preserve current records and IDs. Reconcile duplicates by operator + source/product identity, not by product name alone. Do not overwrite a current product solely because a new price list has a different rate.

## 3. Shearwater — source-led reconciliation register

**Operator:** Shearwater (use the canonical Shearwater operator record/ID only)  
**Source:** `2026 - Shearwater Pricelist (lnternational).pdf`  
**Contact shown in source:** reservations@shearwatervf.com; +263 83 2844471; +263 773 461 716; +263 785 550 499  
**Default status:** Draft / Needs Verification until fees, validity, and package inclusions are confirmed.

### Packages and combinations

| Product | Source base price (USD) | Source notes / verification |
|---|---:|---|
| Tick It to Adventure — any 2 activities | 370 | Source says choose any two from the listed activity set; confirm exclusions/fee treatment. |
| Tick It to Adventure — any 3 activities | 478 | Separate product from the two-activity offer. |
| Gruesome Twosome — rafting + bungee | 347 | Source describes saving $10; verify current availability and mandatory fees. |
| Gruesome Twosome — bungee + jetboat | 312 | Source describes saving $34; verify current availability and mandatory fees. |
| Big Air — bridge swing + bridge slide + bungee | 280 | Package record; keep separate from component activities. |
| Rampage — jetboat + rafting rapids 1–5 | 204 | Package record; verify seasonal/river conditions. |
| Jetboat and Rafting combo | 268 | Source says National Parks fees excluded and instructs guests to bring $12 at check-in; this conflicts with the supplied summary's $10 fee. Confirm with Shearwater. |
| Platinum package | 326 | Source lists sunset cruise, helicopter, Falls tour, rainforest lunch, and bridge tour in the package description, but also says rainforest lunches are optional in packages. **Do not publish inclusions until operator confirms exact inclusions.** |
| Gold package | 247 | Same lunch/inclusion ambiguity; verify exact activities and fee treatment. |
| Silver package | 150 | Same lunch/inclusion ambiguity; verify exact activities and fee treatment. |
| Bronze package | 75 | Same lunch/inclusion ambiguity; verify exact activities and fee treatment. |

### Bridge activities

| Product | Source base price (USD) | Source notes |
|---|---:|---|
| Bungee Jump | 194 | Confirm bridge toll/transfer/other fees separately. |
| Bridge Slide | 58 | Do not merge with tandem slide. |
| Tandem Bridge Slide | 82 | Separate product variant. |
| Bridge Swing | 137 | Source PDF conflicts with supplied summary ($131); use $137 provisionally, pending operator confirmation. |
| Tandem Bridge Swing | 201 | Separate product variant. |

### Rafting, jetboat, and river cruises

| Product | Source base price (USD) | Source notes |
|---|---:|---|
| White Water Rafting — High Water | 161 | Seasonal product variant. |
| White Water Rafting — Low Water | 173 | Seasonal product variant; do not collapse into High Water. |
| Overnight Rafting | 330 | Verify season, itinerary, and inclusions. |
| Jetboat | 141 | Source says a $10 park fee applies; supplied summary agrees on $10. Store fee separately. |
| Riversong Premium Luxury Morning Cruise | 80 | Separate from other operators' morning cruises. |
| Riversong Premium Luxury Lunch Cruise | 100 | Separate product. |
| Riversong Premium Luxury Sunset Cruise | 100 | Separate from Standard Sunset Cruise and all other operators' sunset cruises. |
| Standard Sunset Cruise | 59 | Source PDF conflicts with supplied summary ($52); use $59 provisionally, pending operator confirmation. |
| Dinner Cruise | 110 | Source says park fees excluded and to bring $12; supplied summary says $10. Confirm fee with operator. |

### Scenic flights

| Product | Source base price (USD) | Source notes |
|---|---:|---|
| Flight of Angels — 12–13 minutes | 173 | Source says government fees and fuel surcharge excluded and instructs guests to bring $29; supplied summary says $27. Confirm exact fee. |
| Zambezi Explorer — 20 minutes | 271 | Keep distinct from Wild Horizons or other operators' flights even where naming is similar. |
| Zambezi Spectacular — 25 minutes | 328 | Source says fees total/bring $35; supplied summary says $32. Confirm exact fee. |

### Safari and wildlife

| Product | Source base price (USD) | Source notes |
|---|---:|---|
| Night Game Drive + Shearwater Bush Dinner | 159 | Source lists $18 park fee; supplied summary says $15. Confirm and store separately. |
| AM/PM Game Drive | 95 | Source PDF conflicts with supplied summary ($81); source lists $18 park fee versus supplied $15. Confirm both. |
| Safari Game Walks | 132 | Source lists $18 park fee; supplied summary says $15. Confirm. |
| Through the Eyes of an Elephant | 148 | Described as a suggested donation; do not present as a standard fixed-price activity without confirming wording. |
| Breakfast with Elephants | 100 | Present in source PDF summary; validate inclusions, fees, and availability before publishing. |
| Chobe Day Trip | 229 | Source PDF conflicts with supplied summary ($178). Exact additional fee treatment is not sufficiently clear in the extracted text; confirm directly before publication. |

### Other Shearwater/third-party activities and transfers

| Product | Source base price (USD) | Source notes |
|---|---:|---|
| Quad Bike | 60 | Third-party product listed by Shearwater; confirm actual supplier/operator attribution before publication. |
| Horse Trails | 125 | Source lists $10 park fee; confirm supplier/operator attribution. |
| Rhino Encounter Game Drive | 128 | Source lists $15 park fee; confirm supplier/operator attribution. |
| Boma Dinner | 65 | Source indicates $15 transfer fee; clarify whether transfer is optional/mandatory and who supplies the dinner. |
| Livingstone Island Tour | From 137 | “From” price must remain a starting price; verify season/meal variant and operator attribution. |
| Livingstone Island Transfer — return | 46 | Transfer product, not the Island tour itself; verify transport provider and inclusions. |
| Theatrical Historical Bridge Tour | 64 | Source indicates $12 transfer fee; separate tour and transfer pricing. |
| Traditional Village Tour | 74 | Verify supplier attribution and inclusions. |
| Guided Victoria Falls Tour | 32 | Park/entry fee is additional; exact amount not established in the extracted source. |
| Simunye | 58 | Verify exact experience identity, supplier, and inclusions. |
| Victoria Falls Airport Transfer — one way | 28 | Transfer product; verify pickup zone and capacity. |
| Livingstone Airport Transfer — one way | 40 | Transfer product; verify pickup zone and capacity. |
| Bridge Toll | 3 one way | A fee/toll, not an activity product; model as a fee or clearly labelled pass-through charge, not as a tour. |

## 4. Wild Horizons — user-supplied brochure register

**Operator:** Wild Horizons (use the canonical Wild Horizons operator record/ID only)  
**Source:** User-provided Wild Horizons brochure summary; original brochure verification still required.  
**Default status:** Draft / Needs Verification. All figures are base prices unless the fee is explicitly shown below.

### Packages

| Product | Base price (USD) | Stated inclusions / notes |
|---|---:|---|
| Adventure Pass 1 | 416 | Sunset cruise + any two of: High Wire Pass, 12/13-minute helicopter flight, Night Drive. Verify exact activity options and exclusions. |
| Adventure Pass 2 | 347 | Sunset cruise + any two of: Elephant Encounter, Solo Zip Line or Gorge Swing, White Water Rafting. Verify exact activity options and exclusions. |
| Victoria Falls Classic | 69 | Falls Tour + Lookout Cafe lunch. |
| Wild Horizons Classic | 255 | Helicopter + Falls Tour + Sundowner Cruise. |
| Wild Horizons Classic with Lookout Lunch | 289 | Same package with Lookout lunch; retain as a distinct variant. |
| Zambezi Classic | 94 | Falls Tour + Sundowner Cruise. |
| Zambezi Classic with Lookout Lunch | 122 | Same package with Lookout lunch; retain as a distinct variant. |
| Rafting & Gorge Swing | 274 | Source summary states $18 in park fees; verify activity combination and fee basis. |

**Package fee rule:** The supplied brochure summary says package prices exclude National Parks fees. Do not imply fees are included. Confirm which fees apply to each package before guest-facing publication.

### Adventure activities

| Product | Base price (USD) | Additional fee (USD) |
|---|---:|---:|
| White Water Rafting | 174 | 12 park fee |
| Gorge Swing | 134 | 6 park fee |
| Tandem Gorge Swing | 201 | 6 park fee |
| Zip Line | 108 | 6 park fee |
| Tandem Zip Line | 162 | 6 park fee |
| Flying Fox | 69 | 6 park fee |
| Canopy Tour | 81 | 6 park fee |
| Highwire Pass | 208 | 6 park fee |

### Safari and wildlife

| Product | Base price (USD) | Additional fee (USD) |
|---|---:|---:|
| Full Day Chobe Day Trip | 178 | 20 park fee |
| Elephant Encounter | 169 | 24 park fee |
| Elephant Art Safari & Lunch/Snacks | 212 | 24 park fee |
| Zambezi National Park Game Drive | 83 | 18 park fee |
| Private Reserve Game Drive — AM/PM | 159 | 10 park fee |
| Night Drive or Bush Dinner | 216 | 10 park fee |
| Horseback Safari | 171 | 30 park fee |

### Air experiences

| Product | Base price (USD) | Additional fee (USD) |
|---|---:|---:|
| Helicopter Flight — 12/13 minutes | 174 | 29 government/other fee as described in brochure summary |
| Helicopter Flight — 25 minutes | 329 | 35 government/other fee as described in brochure summary |
| Microlight Flight — 12/15 minutes (Zambia) | 190 | 6 fee |
| Microlight Flight — 25/30 minutes (Zambia) | 380 | 6 fee |

### River cruises

| Product | Base price (USD) | Additional fee (USD) |
|---|---:|---:|
| Sundowner Cruise | 52 | 12 park fee |
| Luxury Zambezi Royal Cruise | 102 | 12 park fee |
| Dinner Cruise | 116 | 12 park fee |

### Tours and other experiences

| Product | Base price (USD) | Additional fee / notes |
|---|---:|---|
| Victoria Falls Tour | 32 | Entry fee additional; exact amount not supplied. |
| Bike Tour | 61 | Verify inclusions and fee treatment. |
| Meet People Village | 91 | Verify inclusions and fee treatment. |
| Home Hosted Lunch | 41 | Verify inclusions and fee treatment. |
| Boma Dinner | 60 | Transfers excluded according to supplied summary. |
| Bamba Tram Sunrise Run | 76 | Supplied summary says transfers included. |
| Livingstone Island — Breakfast Green | 123 | 26 additional fee stated in supplied summary. |
| Livingstone Island — Breakfast High | 133 | 26 additional fee stated in supplied summary. |
| Livingstone Island — Lunch Green | 173 | 26 additional fee stated in supplied summary. |
| Livingstone Island — Lunch High | 183 | 26 additional fee stated in supplied summary. |
| Livingstone Island — High Tea Green | 163 | 26 additional fee stated in supplied summary. |
| Livingstone Island — High Tea High | 173 | 26 additional fee stated in supplied summary. |

**Wild Horizons contact shown in supplied summary:** res310@wildhorizons.co.zw.  
**Validity noted in supplied summary:** rates valid until December 2026; verify against original brochure before using as a published validity statement.

## 5. Conflicts requiring resolution before publication

### Shearwater conflicts — source PDF currently takes precedence provisionally

| Item | User summary | Original PDF transcription | Action |
|---|---:|---:|---|
| Flight of Angels fee | $27 | $29 | Confirm with Shearwater. |
| 25-minute flight fee | $32 | $35 | Confirm with Shearwater. |
| Standard Sunset Cruise | $52 | $59 | Use $59 only provisionally; confirm. |
| Night Game Drive park fee | $15 | $18 | Confirm. |
| AM/PM Game Drive base price | $81 | $95 | Confirm. |
| AM/PM Game Drive park fee | $15 | $18 | Confirm. |
| Chobe Day Trip | $178 | $229 | Confirm price and fee basis. |
| Bridge Swing | $131 | $137 | Confirm. |
| Dinner Cruise park fee | $10 | $12 | Confirm. |
| Jetboat + Rafting combo fee | $10 | $12 | Confirm. |
| Package rainforest lunch | Shown as included | PDF says lunches may be optional | Confirm each package's exact inclusions. |

### Wild Horizons verification queue

- Obtain/review the original brochure to verify the supplied transcription, rate validity, mandatory fee wording, and package inclusion rules.
- Confirm whether the Livingstone Island $26 fee applies uniformly to every listed meal/visit variant.
- Confirm whether package fees are all excluded and whether any inclusions have seasonal or capacity restrictions.
- Verify exact supplier attribution for every activity and package before creating or updating records.

## 6. Existing catalog reconciliation — preserve, compare, do not blindly overwrite

Known existing entries from earlier catalog snapshots include:
- Shearwater: Victoria Falls Rainforest Guided Walking Tour — $35/person, 2.5 hours.
- Shearwater: Zambezi Gorge & Falls Extended Flight — $328/person, 25 minutes (allow approximately 2 hours total for transfers); reconcile against the Shearwater 25-minute scenic-flight naming and fee treatment before editing.
- Wild Horizons: Zambezi National Park Safari Game Drive — $70/person, 3.5 hours; this differs from the new user-supplied brochure summary's $83 base price plus $18 park fee. Do not overwrite without verifying the current rate, validity, and product identity.
- Pure Africa: Zambezi Explorer Luxury Sunset Cruise — $75/person, 2.5 hours. This remains a **Pure Africa** record; do not move it to Shearwater merely because Shearwater has similarly named cruise/flight offers.

These are reconciliation candidates, not instructions to delete or overwrite. Preserve current record IDs and history.

## 7. Required catalog fields and validation gate

For every new or updated product, confirm:
- `operatorId` points to the correct canonical operator document;
- product name and category;
- activity/package/transfer/fee distinction;
- base price, currency, pricing unit (per person, per room, per vehicle, per trip, or “from”);
- mandatory fees as separate structured values, with fee description and whether included;
- duration and season/validity where sourced;
- inclusions, exclusions, age/weight/fitness restrictions where relevant and sourced;
- supplier attribution for third-party activities;
- source document, source date, and last-verified date;
- draft/published status and media ownership.

**Publication gate:** No record from this reconciliation should be published until its operator association, source, base price, fee treatment, and material inclusions have been checked. Similar names are not sufficient evidence that two records are the same product.


## 8. Implementation added on the working branch

The implementation now includes:
- `server/data/operatorCatalogImport.ts`: structured Wild Horizons and Shearwater price-list records with separate operator ownership, categories, package/activity type, base prices, fee metadata, source references, and verification notes.
- `POST /api/coordinator/catalog/import-operator-pricelists`: administrator-only, authenticated, draft-only import endpoint. It requires exactly one recognized canonical operator record for each operator before writing anything.
- `src/components/coordinator/CoordinatorPortal.tsx`: an **Import Operator Price Lists** action in Catalog Governance, visible to administrators.
- `src/services/api.ts`: authenticated API client for the import action.
- Imported **packages** are stored in the `packages` collection; activities and other non-package offers are stored in `products`. Both retain `operatorId`, `catalogImportKey`, source/fee metadata, and verification status.
- Deterministic IDs and import keys make repeat runs idempotent. Existing same-operator/name records without the import key are skipped for manual reconciliation rather than overwritten.
- All imported records remain unpublished. The importer does not publish guest-facing inventory.

### How to run after syncing the branch into Google AI Studio

1. Ensure the branch changes have been merged or otherwise brought into the AI Studio project. AI Studio's GitHub settings support syncing changes, but a separate branch will not automatically become the connected project's checked-out source.
2. Start the app and sign into the Coordinator Desk with an administrator account.
3. Open **Catalog Governance** and choose **Import Operator Price Lists**.
4. Review the completion summary. If the canonical operator records do not match the approved exact aliases, the import stops without writing products.
5. Review drafts and verification notes, reconcile duplicate candidates, and add verified product media before publishing anything.

**Important:** This code change adds the import capability but does not itself write to the live Firestore database. The administrator-triggered import is the step that creates the draft records in the Firestore project configured by the running AI Studio app.
