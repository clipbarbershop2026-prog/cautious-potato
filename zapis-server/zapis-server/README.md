# Zapis — сервер (Node.js, зависимостларсиз)

## Нима бор
- Салон рўйхатдан ўтиши ва логин (email + парол), ҳар бир салоннинг маълумоти алоҳида.
- Маълумотлар сервердаги `data/` папкасида сақланади, ҳамма қурилмадан бир хил кўринади.
- Мижозлар учун ҳавола: `https://САЙТИНГИЗ/b/салон-коди`. Мижоз ёзилса, ёзув салон календарига тушади.
- Икки киши бир вақтда ўзгартирса, тўқнашув аниқланади ва янги маълумот юкланади.

## Ишга тушириш (компьютерда)
    node server.js
Браузерда http://localhost:3000 очинг.

## Интернетга чиқариш
1. Папкани GitHub’га юкланг.
2. render.com (ёки railway.app) да «New Web Service» очиб, шу репозиторийни танланг.
3. Start command: `node server.js`
4. Environment: `TZ=Asia/Tashkent`, `SECRET=узун тасодифий матн`
5. Persistent Disk уланг ва `DATA_DIR` ни шу дискка йўналтиринг. Акс ҳолда қайта ишга тушганда маълумот йўқолади.
6. Ўз доменингизни Settings → Custom Domain орқали уланг. HTTPS автоматик бўлади.

## Сотишдан олдин қилиниши керак
- `data/` папкасидан доимий резерв нусха.
- Кўп мижоз бўлса, JSON-файл ўрнига PostgreSQL.
- Ходимлар учун алоҳида логин ва роллар (ҳозир фақат эгаси киради).
- SMS-эслатма, Click/Payme тўловлари, парол тиклаш, фойдаланиш шартлари.
- Хавфсизлик текшируви.

## Domen ulash (masalan, navbat.kz)
1. Domen nomini ro‘yxatdan o‘tkazuvchi (registrator) saytida bo‘shligini tekshirib, sotib oling.
2. Hosting (Render) → Settings → Custom Domains → `navbat.kz` va `www.navbat.kz` ni qo‘shing.
3. Registrator panelida DNS yozuvlarini Render ko‘rsatgandek kiriting (CNAME / A).
4. Bir necha daqiqadan bir necha soatgacha kuting. HTTPS avtomatik yoqiladi.
5. Brauzerda `https://navbat.kz` ni oching, salon nomi bilan ro‘yxatdan o‘ting.
   Mijozlar uchun havola: `https://navbat.kz/b/salon-kodi` (Онлайн-запись bo‘limida ko‘rinadi).

Render o‘rniga Dockerfile bilan istalgan VPS yoki Fly.io ham mumkin.

## Адреса
- `/` — сайт (лендинг), `/app` — программа для салона, `/b/салон-кодi` — страница записи для клиентов.
