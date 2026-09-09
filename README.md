# Glasto Ticket Ring

Static sign-up + auto-grouping page (this GitHub Pages site) backed by a Google Sheet.
People submit their name, reg number, and their group of 6 / who they know elsewhere;
the page clusters everyone into groups of 6 and works out a "ring" order — groups placed
next to people they already know — for passing spare tickets round on sale day.

## One-time setup

1. **Create a Google Sheet.** Any new blank sheet, e.g. "Glasto Responses".
2. In it, go to **Extensions → Apps Script**. Delete the placeholder code and paste in
   the contents of [`backend/Code.gs`](backend/Code.gs).
3. In that script, change `SECRET` to a codeword you'll share with the group (e.g. via
   WhatsApp). Save.
4. Click **Deploy → New deployment**. Type: **Web app**. Execute as: **Me**. Who has
   access: **Anyone**. Deploy, and authorise it when prompted (it's your own script, so
   this is just Google asking you to confirm).
5. Copy the resulting **Web app URL**.
6. In [`app.js`](app.js), set:
   - `SCRIPT_URL` to the Web app URL from step 5
   - `SHARED_SECRET` to the same codeword you set in step 3
7. Commit and push. GitHub Pages will pick up the change automatically.

Test it by opening the page, entering the codeword, and submitting a dummy sign-up —
check the row lands in your Sheet.

## Notes on the codeword

It's a speed bump, not real security — the page's source (and the codeword inside it)
is publicly visible on GitHub, and the Sheet backend only checks that the caller sent
the right string, not who they are. It stops the page and everyone's reg numbers from
being casually stumbled on (e.g. by search engines), but don't treat it as protecting
sensitive data from a determined snoop. Fine for coordinating with a friend group;
if you want real access control later, that would need Google-account-based auth in
the Apps Script instead.

## On the day of the actual sale

Use the **Groups & ring** tab's **Export tracker CSV** button once groups have settled.
That gives you a CSV with one row per group (all 6 names + reg numbers) in ring order,
with a `Status` column defaulted to "Needs". Import it into a fresh Google Sheet
(File → Import → Upload) for the live tracker you'll actually use during the sale.

Recommended one-time polish on that tracker sheet (not automatable from here):
- Data validation dropdown on `Status`: `Needs`, `Claimed`, `Has ticket`
- Conditional formatting: red = Needs, yellow = Claimed, green = Has ticket
- Share the sheet (Editor access) with everyone in the ring

Pair it with a live group chat as a backup signal — the moment someone starts buying
for a group, they should update the sheet *and* say so in chat, since two people could
otherwise both try to claim the same spare at once.
