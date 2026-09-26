# 🏎️💥 Desi Kart Battle 3D

Ek local multiplayer **3D** kart racing + item-battle game (Smash Kart / Mario Kart jaisa vibe, apna alag desi twist ke saath) — dosto ke saath ek hi WiFi pe khelo. Fully offline-capable — internet ki zaroorat sirf pehli baar `npm install` ke liye hai, uske baad sab kuch local chalta hai (Three.js bhi locally bundled hai, koi CDN dependency nahi).

## Kaise chalayein (apne laptop pe)

1. **Node.js install** hona chahiye (v16+). Check karo: `node -v`
2. Terminal me is folder me jao:
   ```
   cd 3d-kart-battle
   npm install
   npm start
   ```
3. Terminal me dikhega: `Desi Kart Battle 3D server running: http://localhost:3001`
4. Apne laptop pe browser me `http://localhost:3001` kholo (Chrome/Edge/Firefox — recent version).

## Dosto ke saath khelne ke liye (same WiFi)

1. Apne laptop ki **LAN IP** pata karo:
   - Windows: `ipconfig` → "IPv4 Address" dekho (jaise `192.168.1.5`)
   - Mac/Linux: `ifconfig` ya `ip addr` → wifi interface ka IP dekho
2. Dost apne phone/laptop pe (**same WiFi** pe) browser me kholein:
   ```
   http://<aapka-LAN-IP>:3001
   ```
3. Har koi apna naam daal kar "Join Race" dabaye, koi bhi ek "Start Race" dabaye.

## Controls
- **Arrow Keys** ya **WASD** — chalao / mudo
- **E** ya **Enter** — held item use karo
- Mobile pe on-screen D-pad + item button milega

## Game features
- **3D kart racing** — elliptical ring track, 3 laps, jo pehle finish kare wo winner
- **Item boxes** track pe fixed spots pe — pick karne se random item milta hai:
  - 🚀 **Boost** — speed burst
  - 💣 **Ladoo Bomb** — aage fire hota hai, jo kart lage usko stun kar deta hai (spin-out)
  - 🫖 **Chai Spill** — peeche hazard drop karta hai, jo kart usse takraye wo stun ho jata hai
- **Kart bump physics** — dusri kart se takraane pe dono bounce hoti hain
- **Fall-off penalty** — track se bahar ya beech ke "lake" me gir gaye to last checkpoint pe wapas respawn (thoda stun ke saath)
- **Fun animations** — turn pe kart tilt hoti hai, wheels spin hote hain, hit hone pe spin-out, boost pe flame effect, finish pe confetti 🎉
- **Minimap** (top-right) — sabki live position dikhata hai
- **Sound effects** — pickup, boost, hit, countdown, finish (WebAudio, koi audio file nahi chahiye)

## Baad me "live" (internet pe) karna ho to
Ye bhi (pehle wale racing game ki tarah) ek **persistent Node.js server** use karta hai (Socket.io real-time), isliye Netlify jaisi static hosting pe seedha nahi chalega. Live karne ke liye:
- [Render.com](https://render.com) (free tier, Node web service)
- [Railway.app](https://railway.app)
- [Fly.io](https://fly.io)

Bata dena jab ready ho, deploy bhi kar denge.
