# 🏎️ Turbo Dost Racing

Ek local multiplayer 2D top-down racing game — dosto ke saath ek hi WiFi pe khelo, koi internet/hosting nahi chahiye.

## Kaise chalayein (apne laptop pe)

1. **Node.js install** hona chahiye (v16+). Check karo: `node -v`
2. Terminal me is folder me jao:
   ```
   cd multiplayer-racing-game
   npm install
   npm start
   ```
3. Terminal me dikhega: `Turbo Dost Racing server running: http://localhost:3000`
4. Apne laptop pe browser me `http://localhost:3000` kholo.

## Dosto ke saath khelne ke liye (same WiFi)

1. Apne laptop ki **LAN IP** pata karo:
   - Windows: `ipconfig` → "IPv4 Address" dekho (jaise `192.168.1.5`)
   - Mac/Linux: `ifconfig` ya `ip addr` → wifi interface ka IP dekho
2. Dost apne phone/laptop pe (**same WiFi** pe hone chahiye) browser me kholein:
   ```
   http://<aapka-LAN-IP>:3000
   ```
   Example: `http://192.168.1.5:3000`
3. Har koi apna naam daal kar "Join Race" dabaye.
4. Koi bhi ek player "Start Race" dabaye — 3-2-1-GO countdown ke baad race shuru!

## Controls
- **Arrow Keys** ya **WASD** — chalao / mudo
- **Space** — Boost ⚡ (limited, cooldown ke saath)
- Mobile pe on-screen D-pad + boost button automatically dikhega.

## Game rules
- 3 laps ka race, jo pehle finish kare wo winner.
- Track se bahar jaoge to car slow ho jayegi (off-track penalty).
- Dusri car se takrane pe halka bounce hota hai.
- Race khatam hone ke baad "Race Again" se turant naya race lobby ban jata hai.

## Baad me "live" (internet pe) karna ho to
Ye game ek **persistent Node.js server** (Socket.io real-time connections) use karta hai, isliye Netlify jaisi static hosting pe seedha nahi chalega. Live karne ke liye in me se koi ek use karo:
- [Render.com](https://render.com) (free tier, Node web service)
- [Railway.app](https://railway.app)
- [Fly.io](https://fly.io)
- Koi bhi VPS (DigitalOcean, AWS EC2, etc.)

Jab ready ho, bata dena — deploy bhi kar denge.
