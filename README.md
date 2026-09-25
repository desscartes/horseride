# HorseRide

HorseRide, TJK programlarındaki koşuları veri ve model skorlarıyla incelemek için hazırlanmış web-first bir arayüzdür. Uygulama şu an demo veriyle çalışır; gerçek TJK veri kaynağı ve model servisi henüz bağlanmamıştır.

## Çalıştırma

```bash
npm install
npm run dev
```

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

Sonraki teknik adımlar: TJK veri erişim katmanı, geçmiş yarış veri modeli, model servisinin API olarak ayrıştırılması, oran kalibrasyonu ve kullanıcı kupon geçmişi.
