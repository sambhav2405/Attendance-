# Desi Kart Battle 3D

Ek local multiplayer **3D** kart racing + battle-arena game — dosto ke saath ek hi WiFi pe **rooms** bana kar ya **Quick Match** se turant khelo, ya **Team Battle** khel kar squad ke against squad bhiro. Fully offline-capable — internet ki zaroorat sirf pehli baar `npm install` ke liye hai.

## Kaise chalayein (apne laptop pe)

```
cd 3d-kart-battle
npm install
npm start
```
Terminal me dikhega: `Desi Kart Battle 3D server running: http://localhost:3001` — browser me kholo.

## Dosto ke saath khelne ke liye (same WiFi)

1. Apne laptop ki **LAN IP** pata karo (`ipconfig` Windows / `ifconfig` Mac-Linux).
2. Naam daalo, **Racing** ya **Battle Arena** chuno.
3. **Quick Match** — turant kisi bhi open match me daal deta hai (koi code share karne ki zaroorat nahi), ya **Naya Room Banao** se private code milega jo dost ko bhejo.
4. Dost `http://<aapka-LAN-IP>:3001` khol kar wahi karein.
5. Ek room me ab tak **14 players** tak aa sakte hain.

## Game Modes

### Racing
- 2 maps: **Classic Ring** (green/trees) ya **Desert Dunes** (sand/cacti).
- 3 laps, jo pehle poore kare wo jeete. Track pe jump-ramps hain — tez speed pe unse hawa me udo!

### Battle Arena
- 2 maps, dono me ab **bade, proper fighting platforms** hain (chhoti floating disc nahi) jinpe alag-alag obstacles, item box aur boost pad milte hain:
  - **Colosseum** — dark dramatic arena jiske beech me ab asli **glowing lava pit** hai (girne pe seedha "Defeated"), aur uske upar lava se bhi bada, khambo (pillars) pe tika ek **bada floating fighting platform** — do ramp se jump karke upar lado, apna alag obstacle-course aur item boxes bhi hain wahan. Galat kinare se lava ke upar hi gir gaye to seedha splash!
  - **Sky Tower** — 3 manzil (floors) wala pura tower, har floor pehle se kaafi bada aur khud ek poora arena — ramp/slide se upar chado, upar jaate jaate arena thoda chhota par zyada intense hota jaata hai.
  - Har floor **alag hai** — neeche wale floor ke gun/bomb/gravity-pulse/kart-collision upar wale floor ko touch nahi karte (aur ulta bhi nahi), taaki upar-neeche ki fighting bilkul fair aur clean rahe.
- Kisi ko maaro to point milta hai, wo **5 second me respawn** hota hai (thodi der ke liye "spawn protection" bhi milti hai).
- **Har attack ka apna animation/impact effect hai** — bomb/rocket explosion, freeze ray ka ice-shatter, gun/shrink/reverse ray ka spark, oil/ice trail ka splash, EMP blast ka expanding ring, gravity pulse ka pull-ring, aur teleport dash ka warp-flash — sabke liye alag particle burst, sirf khud ke liye nahi, arena ke sabhi players ke liye dikhta hai.
- Gaadiyan aapas me seedha **takra bhi sakti hain** (dono same floor pe ho to) — takkar se dono thoda bounce back hote hain aur speed kam hoti hai, jaisa asli battle-kart game me hota hai.
- Platforms ab premium arena jaisi dikhti hain — glowing trim-ring border, corner lamp-posts, aur ek se zyada support pillars.
- **2 win conditions**: Time Attack (3 min, sabse zyada points wala jeete) ya First to 10 Points.
- **Team Battle**: Room banate waqt "Team Battle (Red vs Blue)" chuno — players khud-ba-khud dono team me balance ho jaate hain, apni team ko maar nahi sakte (no friendly fire), aur team ka combined score jeetta hai.
- **Quick Match rooms me kabhi bhi naya player drop-in kar sakta hai** — match beech me chal raha ho tab bhi, jab tak jagah hai.
- Match khatam hone ke **10 second baad agla round khud shuru** ho jata hai.
- Koi bhi player match ke beech me "Room Chhodo" dabakar exit kar sakta hai — baaki match chalta rehta hai.

## Physics aur Animation
- **Power-Slide mini-turbo**: tez speed pe ek hi taraf continuously mudo — car ke peeche neela spark aana shuru hoga, thodi der baad orange ho jayega (bada charge). Turn chhodte hi ek speed-boost milta hai — jitna bada charge, utna bada boost. Yahi asli kart-racing games ka "drift boost" hai.
- **Landing squash** — ramp/platform se jump ke baad zameen pe wapas aate hi car halka sa squash-and-stretch karti hai, real physics jaisa "juicy" feel ke liye.
- Body turn ke hisaab se thoda bank/lean karti hai, aur hawa me thoda nose-tilt bhi hota hai.
- Kart-vs-kart collision, gun/bomb hits, gravity-pulse aur EMP sab ab **floor-aware** hain — sirf usi floor pe kaam karte hain jahan attacker/target dono khade hain, taaki multi-floor battle bilkul fair rahe.

## Controls
- **Arrow Keys / WASD** — chalao / mudo (ek taraf der tak mudo speed pe to Power-Slide charge hoga)
- **Space** (hold) — Gun — ab **limited ammo** (15 rounds, dheere-dheere regenerate hoti hai)
- **E / Enter** — held power-up use karo

## Vehicles
Lobby me 3 gaadiyon me se chuno (sirf look alag hai, physics/hitbox same rehta hai — fair rehta hai sabke liye):
- **Classic Kart** — apna khud ka procedural low-poly kart
- **Toy Racer** — open-source "Toy Car" model (Guido Odendahl, public domain / CC0)
- **Milk Truck** — open-source "Cesium Milk Truck" model (Cesium, CC-BY 4.0)

## 15 Power-ups
Track pe box "smash" karke random power-up milta hai. Poori list + icon "Power-up Manual" button me (lobby screen) dekh sakte ho:

**Attack:** Bomb Shell, Oil Slick, Freeze Ray, Homing Rocket, Shrink Ray, Reverse Ray, Ice Trail, EMP Blast
**Buff:** Nitro Boost, Shield, Mega Ram, Gravity Pulse, Teleport Dash, Ammo Overload, Phantom Cloak, **Enemy Radar** (naya!)

Pehle 4 attack items (Bomb/Oil/Freeze/Homing) **knock-out** karte hain (Battle me point milta hai); baaki attack items sirf annoying debuff dete hain (knock-out nahi karte) — thoda strategy add karta hai. Ab boxes bhi asli **mystery box** jaisa dikhte hain — bada "?" wala rotating box, bounce karta hua.

## Mega Booster
Har ~25 second me kisi boost-pad ke paas ek chamakta hua orange **Mega Booster** beacon spawn hota hai — usse le lo to kuch second ke liye normal nitro se bhi zyada tez speed milti hai. Sirf ek player le sakta hai, phir wapas timer pe respawn hota hai.

## Kya naya hai is version me
- **3 alag vehicles** — apna procedural kart + 2 real open-source 3D models (Toy Racer, Milk Truck)
- **Wall-clip bug fix** — kart ab colourful wall ke andar nahi ghusta, ek chhota gap rehta hai
- **Jump ramps** — track pe udo
- **Room capacity 14 tak**, aur **Quick Match rooms me drop-in join** (match ke beech me bhi)
- **Auto-next-round** (10 sec) aur **mid-match Room Chhodo** button
- **Limited gun ammo** with regen
- **16 unique power-ups** (including naya Enemy Radar) + in-game Manual
- **Icons everywhere, koi emoji nahi** (custom SVG icon set)
- **Sky Tower** — 3-floor battle map, ramps/slides se upar chado
- **Mystery-box style item boxes** — bounce/rotate karta hua "?" box
- **Mega Booster** — fixed interval pe spawn hone wala super-speed power-up
- **Enemy Radar minimap reveal** — stealth players bhi dikhte hain jab radar active ho
- **Team Battle mode** — Red vs Blue, auto-balanced teams, no friendly fire, combined team score
- **Bade fighting platforms** — Colosseum + Sky Tower dono ke upar-wale floors ab poore proper stage jitne bade, apne obstacles/items/boost pad ke saath
- **Har attack ka apna impact-animation** — explosions, ice-shatter, sparks, splash, EMP ring, warp-flash
- **Glowing lava dead-zones** aur premium-look platforms (trim-ring, lamp-posts, multiple support pillars)
- **Power-Slide mini-turbo** (drift boost) — asli kart-racing physics feel
- **Floor-aware combat** — cross-floor gun/collision bugs fix, taaki multi-floor battle fair rahe

## Hosting — Render.com pe deploy (bilkul free, koi card nahi)

Backend Node.js + **Socket.io** (WebSockets) pe hai — isko ek continuously-running server chahiye, isliye **Netlify pe seedha nahi chalega** aur **Cloudflare pe bina bade rewrite ke nahi chalega**. Fly.io ab free tier ke liye bhi card maangta hai, isliye **Render.com** best rasta hai — bilkul free, **koi payment info bilkul nahi lagti**.

Repo me `render.yaml` (Blueprint) pehle se ready hai — Render usse khud padh lega, kuch type nahi karna:

1. **[render.com](https://dashboard.render.com/register)** kholo → **"Sign up with GitHub"** (usi account se jisme ye repo hai)
2. Dashboard me **"New +"** → **"Blueprint"** → apni `Attendance-` repo select karo, branch `claude/zealous-bardeen-13tlno` choose karo
3. Render `render.yaml` khud detect kar lega — bas **"Apply"** dabao

2-3 minute me live link milega jaisе `https://desi-kart-battle-3d.onrender.com` — ye link kisi ko bhi bhejo, seedha browser me khulega, kuch install nahi karna, mobile pe bhi chalega.

**Ek cheez dhyaan me rakho:** free tier pe 15 min koi na khele to server so jata hai — agli baar koi khole to **pehli request 15-20 second slow** hogi, uske baad sab normal fast chalega. Ye Render ke free tier ka hi tareeka hai, koi bug nahi.
