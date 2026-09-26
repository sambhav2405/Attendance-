# 🏎️💥 Desi Kart Battle 3D

Ek local multiplayer **3D** kart racing + item-battle game (Smash Kart / Mario Kart jaisa vibe, apna alag desi twist ke saath) — dosto ke saath ek hi WiFi pe **rooms** bana kar khelo. Fully offline-capable — internet ki zaroorat sirf pehli baar `npm install` ke liye hai, uske baad sab kuch local chalta hai (Three.js bhi locally bundled hai, koi CDN dependency nahi). Phone pe bhi smooth chalta hai — touch controls automatically aa jaate hain.

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

## Dosto ke saath khelne ke liye (same WiFi, rooms ke saath)

1. Apne laptop ki **LAN IP** pata karo:
   - Windows: `ipconfig` → "IPv4 Address" dekho (jaise `192.168.1.5`)
   - Mac/Linux: `ifconfig` ya `ip addr` → wifi interface ka IP dekho
2. Ek banda "🏗️ Naya Room Banao" dabaye — usse ek 4-letter **Room Code** milega (jaise `HZUD`).
3. Baaki dost apne phone/laptop pe (**same WiFi** pe) browser me `http://<aapka-LAN-IP>:3001` kholein, apna naam daalein, wahi Room Code daal kar "🔑 Join" dabayein.
4. Jab sab room me aa jayein, koi bhi "Start Race" dabaye.

   Ek hi WiFi pe **multiple alag rooms** bhi ek saath chal sakte hain — har room ki apni alag race hoti hai, ek dusre se independent.

## Controls
- **Arrow Keys** ya **WASD** — chalao / mudo
- **Space** (hold) — 🔫 Gun (unlimited, thoda weak, cooldown ke saath)
- **E** ya **Enter** — held item use karo (boost/bomb/oil)
- Mobile pe on-screen D-pad + 🔫 + 🎯 buttons automatically aa jaate hain

## Game features
- **Bada 3D map** — elliptical ring track, colourful red/white **solid walls** (bounce hoge takrane pe), ek risky **lake** beech me (gir gaye to last checkpoint pe respawn)
- **Obstacles** — colourful traffic drums track pe scattered, takrane pe halka stun + speed loss
- **Boost pads** ⚡ — track pe fixed glowing pads, upar se drive karo to free speed boost
- **Item boxes** — pick karne se random item milta hai:
  - 🚀 **Boost** — speed burst
  - 💣 **Ladoo Bomb** — aage fire hota hai, jo kart lage usko stun kar deta hai (spin-out)
  - 🫖 **Chai Spill** — peeche hazard drop karta hai, jo kart usse takraye wo stun ho jata hai
- **Gun** 🔫 — Space dabaye rakho, continuous chhoti bullets fire hoti hain (weak par unlimited, chhota cooldown)
- **Kart bump physics** — dusri kart se takraane pe dono bounce hoti hain
- **Room system** — apna private room banao ya code se join karo, kai rooms parallel chal sakte hain
- **Decorated map** — mountains, trees, colourful bunting flags, checkered start/finish arch
- **Fun animations** — turn pe kart tilt hoti hai, wheels spin hote hain, hit hone pe spin-out, boost pe flame effect, finish pe confetti 🎉
- **Minimap** (top-right) — sabki live position dikhata hai
- **Sound effects** — pickup, boost, hit, shoot, countdown, finish (WebAudio, koi audio file nahi chahiye)
- **Mobile-friendly** — automatically lighter settings (antialias off, capped pixel ratio) taaki phone pe smooth chale

## Baad me "live" (internet pe) karna ho to
Ye bhi ek **persistent Node.js server** use karta hai (Socket.io real-time), isliye Netlify jaisi static hosting pe seedha nahi chalega. Live karne ke liye:
- [Render.com](https://render.com) (free tier, Node web service)
- [Railway.app](https://railway.app)
- [Fly.io](https://fly.io)

Bata dena jab ready ho, deploy bhi kar denge.
