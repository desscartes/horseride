# HorseRide

HorseRide, TJK programlarındaki koşuları veri ve model skorlarıyla incelemek için hazırlanmış web-first bir arayüzdür. Uygulama şu an demo veriyle çalışır; gerçek TJK veri kaynağı ve model servisi henüz bağlanmamıştır.

## Çalıştırma

```bash
npm install
npm run dev
```

API canlı TJK CSV’sini alırken programı yerel SQLite veritabanına yazar. Veritabanı `data/horseride.sqlite` altında tutulur ve git’e gönderilmez. Durum kontrolü için:

```bash
curl http://localhost:8787/api/history/health
curl "http://localhost:8787/api/history/horse?name=GOLDEN%20STARFIRE"
```

Canlı veri adaptörü için `.env.example` dosyasını `.env` olarak kopyalayıp JSON dönen bir endpoint tanımlayın:

```bash
VITE_RACE_API_URL=https://api.example.com/races/today
```

Endpoint şu formatı döndürmelidir: `{ "races": [ ... ] }`. TJK erişimi ve veri kullanım izni doğrulanmadan doğrudan scraping yapılmaz; sağlayıcı katmanı bu nedenle arayüzden ayrı tutulmuştur.

Üretim kontrolü:

```bash
npm run build
```

## Android

Arayüz Capacitor ile Android kabuğuna alınmaya hazırdır. Android Studio ve Android SDK kurulu bir makinede:

```bash
npm run android:add
npm run android:sync
npm run android:open
```

İlk sürüm kapsamı:

- Günlük yarış programı görünümü
- Koşu bazlı model favorisi ve kazanma olasılığı
- Risk profiline göre hazır kupon kartları
- Mobil responsive web arayüzü

## Model notu

Canlı CSV adaptörü AGF alanını bilerek kullanmaz. Başlangıç skoru son form, en iyi derece, kilo, yarışa kalan gün ve start numarasından oluşur; bu henüz eğitilmiş bir makine öğrenmesi modeli değildir. Jokeyin geçmiş kazanma/başlama verisi mevcut ücretsiz CSV’de bulunmadığı için şu an skora dahil edilmez. Bir sonraki veri katmanı, izinli bir geçmiş sonuç kaynağıyla at ve jokey geçmişini toplamak, zaman bazlı backtest yapmak ve olasılıkları kalibre etmektir.

Sonraki teknik adımlar: TJK veri erişim katmanı, geçmiş yarış veri modeli, model servisinin API olarak ayrıştırılması, oran kalibrasyonu ve kullanıcı kupon geçmişi.
