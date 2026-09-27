# 🏎️💥 Desi Kart Battle 3D

Ek local multiplayer **3D** kart racing + battle-arena game — dosto ke saath ek hi WiFi pe **rooms** bana kar ya **Quick Match** se turant khelo. Fully offline-capable — internet ki zaroorat sirf pehli baar `npm install` ke liye hai, uske baad sab kuch local chalta hai. Phone pe bhi smooth chalta hai.

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

1. Apne laptop ki **LAN IP** pata karo (`ipconfig` Windows / `ifconfig` Mac-Linux).
2. Naam daalo, **Racing 🏁** ya **Battle Arena ⚔️** chuno.
3. Do tareeke:
   - **⚡ Quick Match** — turant kisi bhi open match me daal deta hai (ya naya bana deta hai), koi code share karne ki zaroorat nahi.
   - **🏗️ Naya Room Banao** — ek 4-letter code milega, dost apne phone/laptop pe `http://<aapka-LAN-IP>:3001` khol kar wahi code daal ke join karein.
4. Sab aane ke baad "Start" dabao.

## Game Modes

### 🏁 Racing
- **2 maps:** Classic Ring (green/trees) ya Desert Dunes (sand/cacti) — dono ka layout same hai bas dikhta bilkul alag hai.
- 3 laps, jo pehle poore kare wo jeete.

### ⚔️ Battle Arena (naya!)
- **Map:** Colosseum — dark dramatic arena, grandstands, beech me ek khatarnak death-pit.
- **Point system:** kisi ko gun/bomb/chai-spill se maaro to 1 point milta hai, wo player **5 second me respawn** ho jata hai.
- **2 win conditions** (room banate waqt chuno):
  - ⏱️ **Time Attack (3 min)** — time khatam hone pe sabse zyada points wala jeetega
  - 🎯 **First to 10 Points** — jo pehle 10 point kare wo turant jeet jayega
- Live scoreboard, kill-feed ("Rahul 🔫 Amit"), respawn countdown overlay, hit-marker jab tum kisi ko maaro.

## Controls
- **Arrow Keys** ya **WASD** — chalao / mudo
- **Space** (hold) — 🔫 Gun (unlimited, weak, chhota cooldown)
- **E** ya **Enter** — held item use karo (boost/bomb/oil)
- Mobile pe on-screen D-pad + 🔫 + 🎯 buttons automatically aa jaate hain

## Features
- **Naya, behtar kart model** — layered chassis, spoiler, front bumper, helmet+visor wala driver, alloy-style wheels
- **Colourful solid walls** — physics ke saath real bounce
- **Obstacles** — colourful traffic drums
- **Boost pads** ⚡ — free speed boost
- **Item boxes** — 🚀 Boost, 💣 Ladoo Bomb, 🫖 Chai Spill
- **Gun** 🔫 — hamesha available, continuous fire
- **Room system + Quick Match** — private code se ya random matchmaking se khelo, kai rooms parallel chal sakte hain
- **Har mode/map ka apna theme** — alag sky, ground, walls, decorations (trees/cacti/grandstands)
- **Jeetne/haarne ki screen** — 🏆 "Congratulations! You Won!" ya 💀 "Defeated!" + final scoreboard
- **Fun animations** — tilt, wheel-spin, spin-out, boost flame, confetti, hit-marker, respawn overlay
- **Minimap, sound effects, mobile-tuned graphics**

## Baad me "live" (internet pe) karna ho to
Ye ek **persistent Node.js server** use karta hai (Socket.io real-time), isliye Netlify jaisi static hosting pe seedha nahi chalega. Live karne ke liye Render.com / Railway.app / Fly.io use karo — bata dena, deploy bhi kar denge.
