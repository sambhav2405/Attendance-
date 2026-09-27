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
- 2 maps: **Colosseum** — dark dramatic arena, grandstands, beech me khatarnak death-pit. Ya **Sky Tower** — 3 manzil (floors) wala tower, har floor ramp/slide se juda hua, upar jaate jaate arena chhota aur intense hota jaata hai.
- Kisi ko maaro to point milta hai, wo **5 second me respawn** hota hai (thodi der ke liye "spawn protection" bhi milti hai).
- **2 win conditions**: Time Attack (3 min, sabse zyada points wala jeete) ya First to 10 Points.
- **Team Battle**: Room banate waqt "Team Battle (Red vs Blue)" chuno — players khud-ba-khud dono team me balance ho jaate hain, apni team ko maar nahi sakte (no friendly fire), aur team ka combined score jeetta hai.
- **Quick Match rooms me kabhi bhi naya player drop-in kar sakta hai** — match beech me chal raha ho tab bhi, jab tak jagah hai.
- Match khatam hone ke **10 second baad agla round khud shuru** ho jata hai.
- Koi bhi player match ke beech me "Room Chhodo" dabakar exit kar sakta hai — baaki match chalta rehta hai.

## Controls
- **Arrow Keys / WASD** — chalao / mudo
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

## Hosting — important, please read

Maine backend Node.js + **Socket.io** (WebSockets) pe banaya hai kyunki real-time multiplayer (30 baar/second position updates) ke liye ek persistent, stateful server chahiye — sabhi players ka live game state RAM me rakhna padta hai.

**Netlify par seedha nahi chalega.** Netlify sirf static files + short-lived serverless functions serve karta hai — koi bhi function har request pe naya/stateless spin hota hai, wo continuously running server nahi hai jo WebSocket connections aur live game state hold kar sake. Aapki Attendance app (jo static HTML/JS hai) Netlify ke liye bilkul sahi hai, lekin ye game usi tarah "bas set ho jaye" nahi hoga.

**Cloudflare — haan, ho sakta hai, lekin free nahi "as-is":** Cloudflare Workers + **Durable Objects** real-time multiplayer WebSocket apps ke liye actually support karte hain, aur inka ek free tier bhi hai. Lekin iske liye current Node/Express/Socket.io backend ko Cloudflare Workers ke runtime ke liye **dobara likhna** padega (Socket.io library Cloudflare Workers pe nahi chalti — seedhe WebSocket API + Durable Objects use karne honge). Ye ek chhota tweak nahi hai, ek separate migration project hai.

**Sabse aasan free/sasta rasta abhi ke liye:**
- **Render.com** — free tier pe Node web service directly deploy ho jata hai, Socket.io bina kisi rewrite ke chal jayega. (Free tier thodi der inactive rehne par so jata hai, first request slow ho sakta hai.)
- **Railway.app** — similar, thoda paid-leaning free tier.
- **Fly.io** — free allowance ke saath persistent Node apps.

**Agar chaho** to main:
1. Isi code ko Render/Railway/Fly pe as-is deploy kar sakta hoon (sabse tez rasta, koi rewrite nahi), ya
2. Cloudflare Workers + Durable Objects ke liye backend rewrite kar sakta hoon (zyada kaam, lekin phir Cloudflare ke generous free tier pe chalega)

Bata dena kaunsa rasta chahiye, us hisaab se aage badhta hoon.
