# Games Zone me naye games kaise add karein

`games.html` file site ke root me hai — `index.html` ke header me gamepad icon se wahan pahuncha jaata hai (`/games.html`).

## 1. GameDistribution se games add karna (free)

1. **[gamedistribution.com](https://gamedistribution.com)** pe jao → **"Become a publisher"** / **Sign up** (free, email se ho jata hai).
2. Login karne ke baad publisher dashboard me **"Games"** ya **catalog** section me jao, jo games pasand aayein unhe apni list me add karo.
3. Har game ka apna **Game ID** hota hai (GUID jaisa dikhta hai, e.g. `01a2b3c4-5678-90ab-cdef-1234567890ab`) — wo copy karo.
4. `games.html` file kholo, `GD_GAMES` array dhundo (neeche jaisa dikhta hai):
   ```js
   const GD_GAMES = [
       { name: "Racing Game", cat: "Racing", gdId: "", icon: "fa-car" },
       ...
   ];
   ```
5. Jis game ka ID mila hai, uski `gdId: ""` me paste kar do, aur `name`/`cat` (category) apne hisaab se badal do. Bas — save karo, push karo, site pe wo game live ho jayega.
6. Naya game add karna ho to list me ek naya `{ name: "...", cat: "...", gdId: "...", icon: "fa-..." }` object jod do. Icon names [Font Awesome](https://fontawesome.com/search?o=r&m=free) se koi bhi le sakte ho (jaise `fa-car`, `fa-bolt`, `fa-chess`).

Jab tak `gdId` khali hai, us game ka card "jald aa raha hai" dikhata hai — koi broken cheez nahi dikhti.

## 2. AdSense banners lagana (aapka account pehle se active hai: `pub-7200179743941578`)

1. **[AdSense dashboard](https://www.google.com/adsense)** me login karo → **Ads** → **By ad unit** → **Display ads** → naya ad unit banao (naam kuch bhi rakh do, e.g. "Games Zone Top Banner").
2. Wo tumhe ek **`data-ad-slot="XXXXXXXXXX"`** number dega — usko copy karo.
3. `games.html` me do jagah `data-ad-slot="0000000000"` aur `data-ad-slot="0000000001"` likha hai (top banner aur mid-page banner) — inhe apne real slot numbers se replace kar do.
4. Aur ad-slot chahiye ho (jaise sidebar) to `.ad-slot` wala poora `<div>` copy-paste karke naya `data-ad-slot` daal do jahan chaho.

## 3. Apna khud ka multiplayer game (3d-kart-battle) jodna

`games.html` me ye line hai:
```js
const KART_BATTLE_URL = "https://desi-kart-battle-3d.onrender.com";
```
Jab bhi `3d-kart-battle` ko Render (ya jahan bhi) pe deploy karo, us live URL ko yahan paste kar do — "Play Now" button seedha wahan le jayega.

## Sach-sach baat: earning kab shuru hogi

- **AdSense banners**: turant kaam karna shuru kar denge jaise hi real `data-ad-slot` daaloge — lekin earning tabhi dikhegi jab real users site pe aakar ads dekhenge/click karenge.
- **GameDistribution in-game ads**: unke games khud ke andar bhi ads dikhate hain, uska revenue-share GameDistribution ke apne dashboard me milta hai (alag se track hota hai, AdSense se alag).
- Dono ka asli paisa **traffic pe depend karta hai** — jitna zyada log site pe aa ke games khelenge, utni earning badhegi. Shuru me chhoti earning hi aayegi jab tak site ka traffic na badhe.
