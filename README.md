# BioSync

Üretim ve lojistikte elde kalan **temiz tarımsal yan ürünleri** (meyve kabukları, kahve posası, standart dışı
sebzeler) bunları hammadde olarak kullanan **biyomateryal, kozmetik ve alternatif gıda** üreticileriyle eşleştiren
B2B pazar yeri prototipi. Hedef downcycling (yem/enerji) değil **upcycling**.

Akış: ilan formu (fotoğraf, atık türü, miktar, konum) → **Gemini Vision** ile kalite değerlendirmesi →
**50 km içinde** en kârlı ve en düşük karbonlu alıcı eşleşmesi → kartlar + harita.

> Alıcılar **kurgusaldır** (demo verisi). Eşleştirme formülleri ve sabitler:
> **[docs/ESLESTIRME_MANTIGI.md](docs/ESLESTIRME_MANTIGI.md)**

| Katman | Teknoloji |
|--------|-----------|
| Mobil | Expo SDK 57 (Expo Go), React Native, TypeScript |
| Sunucu | Node.js + Express 5, TypeScript (tsx), zod |
| AI | Gemini (`@google/genai`), JSON şema + zod doğrulama |
| Harita | `react-native-webview` + Leaflet + OpenStreetMap |

---

## Gereksinimler

- **Node.js 20.6+** (`--env-file` için; v24 ile denendi)
- Telefonda **Expo Go** (SDK 57 destekli sürüm)
- Telefon ve bilgisayar **aynı Wi-Fi ağında**
- Bir **Gemini API anahtarı** ([Google AI Studio](https://aistudio.google.com/))

---

## Kurulum (Windows / PowerShell)

### 1. PowerShell betik izni (bir kez)

`npx` / `npm` komutları "running scripts is disabled on this system" hatası verirse:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 2. Bağımlılıklar

```powershell
cd biosync\server
npm install
cd ..\app
npm install
```

### 3. Sunucu ayarları: `server/.env`

```powershell
cd ..\server
Copy-Item .env.example .env
```

`server/.env` dosyasını açıp doldurun:

```
GEMINI_API_KEY=<anahtarınız>
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

- `GEMINI_MODEL` **model kimliği** olmalı (`gemini-2.5-flash` gibi), ekranda görünen ad ("Gemini 2.5 Flash") değil.
- Anahtarı **asla** `.env.example` dosyasına yazmayın; o dosya git'e gider. `.env` git dışındadır.

### 4. Mobil ayarlar: `app/.env`

Bilgisayarınızın Wi-Fi IP adresini bulun:

```powershell
ipconfig
```

"Kablosuz LAN bağdaştırıcısı Wi-Fi" altındaki **IPv4 Adresi**ni kullanın (`vEthernet` / Hyper-V adreslerini değil).

```powershell
cd ..\app
Copy-Item .env.example .env
```

`app/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:3000
```

Telefonda `localhost` çalışmaz; mutlaka bilgisayarın LAN IP'si yazılmalıdır. Bu değer uygulama paketine gömülür,
buraya gizli bilgi yazmayın.

### 5. Çalıştırma: iki terminal

**Terminal 1 – sunucu**

```powershell
cd biosync\server
npm run dev
```

Kontrol: telefonun tarayıcısında `http://<IP>:3000/health` → `{"ok":true}`

> `.env` değiştirirseniz sunucuyu **Ctrl+C ile durdurup yeniden başlatın**; `.env` yalnızca açılışta okunur.

**Terminal 2 – Expo**

```powershell
cd biosync\app
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.XXX"
npx expo start -c
```

- `REACT_NATIVE_PACKAGER_HOSTNAME`: QR koduna doğru IP'nin girmesini sağlar (bilgisayarda Hyper-V gibi sanal ağ
  kartları varsa Expo yanlış adresi seçebilir).
- `-c`: Metro önbelleğini temizler; `app/.env` değiştiğinde **gereklidir**.

Ardından QR kodu Android'de **Expo Go**, iPhone'da **Kamera** ile okutun. QR okunmazsa Expo Go'da
"Enter URL manually" → `exp://192.168.1.XXX:8081`.

### Sorun giderme

| Belirti | Çözüm |
|---------|-------|
| Expo Go bağlanmıyor | Telefonda `http://<IP>:8081/status` açılıyor mu? Açılmıyorsa aynı ağda değilsiniz ya da modemde istemci izolasyonu var → `npx expo start --tunnel` |
| Eski ekran görünüyor ("Open up App.tsx…") | Telefonu sallayıp **Reload** veya `npx expo start -c` |
| "Sunucu yapılandırması eksik: GEMINI_API_KEY…" | `server/.env` dolu mu? Sunucuyu yeniden başlattınız mı? |
| "AI modeli bulunamadı" | `GEMINI_MODEL` model kimliği olmalı (`gemini-2.5-flash`) |
| "Sunucuya bağlanılamadı" | Terminal 1 açık mı? `app/.env` IP'si doğru mu? Değiştirdiyseniz `expo start -c` |

---

## Demo adımları

1. **Form**: Kamera veya Galeri'den bir yan ürün fotoğrafı seçin (örn. mandalina kabuğu), atık türünü yazın,
   miktarı **100 kg** girin.
2. **Konum**: "Konumumu al" veya "Konumu elle gir" → aşağıdaki test koordinatlarından biri.
3. **Analiz Et** → "AI Ürün Kalitesini Analiz Ediyor..." (birkaç saniye).
4. **Sonuç**: Kalite Güven Puanı, bozulma durumu, raf ömrü, en uygun 1-3 endüstri ve Türkçe değerlendirme.
5. **Eşleşmeler**: "Eşleşme Bulundu" kartları (mesafe, taşıma maliyeti, net kâr, CO₂, çöpe gitmesi önlenen kg),
   tahmini net iklim etkisi, elenen alıcı özeti ve harita (50 km dairesi + alıcılar).

Göstermeye değer senaryolar:

| Senaryo | Beklenen |
|---------|----------|
| İstanbul, 100 kg | 2 eşleşme; "1 alıcı zarar nedeniyle, 1 alıcı mesafe nedeniyle elendi." |
| Ankara veya Antalya, **15 kg** | Yalnızca en yakın alıcı kalır (sabit sefer ücreti küçük partide uzak alıcıyı zarara sokar) |
| Aynı ilan, farklı şehir koordinatı | Liste ve harita değişir |
| Alakasız fotoğraf (masa, telefon) | Düşük puan, "Organik yan ürün tespit edilmedi", eşleştirme yapılmaz |
| Sunucu kapalıyken "Analiz Et" | Hata ekranı + "Tekrar dene" / "Forma dön" (form verisi korunur) |

### Test koordinatları ("Konumu elle gir")

| Şehir | Enlem | Boylam |
|-------|------:|-------:|
| İstanbul (Ümraniye) | 41.0160 | 29.1200 |
| Ankara (Kızılay) | 39.9200 | 32.8540 |
| Antalya (Muratpaşa) | 36.8870 | 30.7050 |

---

## Ekran görüntüleri

<!-- Görseller docs/gorseller/ altına aşağıdaki adlarla eklenecek (teslimden önce). -->

| Form | Analiz | Sonuç | Eşleşmeler + harita |
|------|--------|-------|---------------------|
| ![Form](docs/gorseller/1-form.png) | ![Analiz](docs/gorseller/2-analiz.png) | ![Sonuç](docs/gorseller/3-sonuc.png) | ![Eşleşmeler ve harita](docs/gorseller/4-eslesme-harita.png) |

---

## Testler ve kontroller

```powershell
cd server
npm test            # matchBuyers / evaluateBuyers (node:test)
npx tsc --noEmit

cd ..\app
npx tsc --noEmit
npx expo lint
```

---

## Notlar ve sınırlar

- **Kurgusal alıcılar**: Firma adları uydurmadır; konumlar gerçek sanayi bölgeleri/teknoparklar civarındadır.
- **Tahmini değerler**: Taşıma maliyeti, CO₂ ve net iklim etkisi demo varsayımlarına dayanır; ayrıntı ve kaynaklar
  [docs/ESLESTIRME_MANTIGI.md](docs/ESLESTIRME_MANTIGI.md) içinde.
- **Harita**: OpenStreetMap'in herkese açık görüntü sunucusu yoğun trafik için değildir; prototip/demo içindir.
- Kapsam dışı (bilinçli): giriş/hesap, ödeme, veritabanı, bildirim, mesajlaşma, gerçek alıcı kaydı.
