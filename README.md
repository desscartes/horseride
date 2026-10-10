# GanyanZekası

GanyanZekası, TJK yarış bültenlerini, at/jokey performansını ve idman verisini toplayıp incelemek için hazırlanmış bir uygulama ve yerel veri servisidir.

## Çalıştırma

```bash
npm install
npm run dev
```

API önce resmi TJK API’sini dener; API erişimi yoksa şehir bazlı TJK CSV’lerini kullanır. CSV’nin yanında meeting sayfasındaki at/jokey kimliklerini, koşu başına idman splitlerini, at geçmişini ve jokey istatistiklerini de alır. Ham kaynaklar ve normalize edilmiş yarış kayıtları varsayılan olarak `data/horseride.sqlite` içindeki yerel SQLite veritabanında tutulur; `HORSERIDE_DB` ile başka bir dosya seçilebilir. Bu tercih ilk aşamada Supabase’e göre daha az yapılandırma gerektirir ve tek cihazlı yerel test için yeterlidir. Barındırılan API, çok kullanıcılı erişim veya cihazlar arası ortak veri gerektiğinde aynı kayıtları Supabase’e taşıyabiliriz.

Veri alımını çalıştırmak ve durumunu kontrol etmek için:

```bash
curl http://localhost:8787/api/history/health
curl "http://localhost:8787/api/races?city=Bursa&date=2026-10-02"
```

TJK anahtarı zorunlu değildir; resmi API erişimi olmazsa şehir bazlı CSV ve TJK sayfaları kullanılır. Günlük yarış kartı SQLite’a kaydedildikten sonra panodaki **Günün AI tahminini al** düğmesi seçili kartı tek OpenAI isteğiyle analiz eder. Bu istek TJK’yı yeniden çağırmaz. Sonuç tarih ve şehir başına SQLite’a bir kez kaydedilir; tekrar istek aynı sonucu önbellekten döndürür. Sayfa açılışında otomatik AI isteği yapılmaz.

OpenAI anahtarı yalnızca backend sürecine tanımlanmalıdır. Windows’ta proje kökünde `.env.example` dosyasını `.env` adıyla kopyalayın, `OPENAI_API_KEY` alanına kendi anahtarınızı girin ve API’yi yeniden başlatın:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run api
```

`OPENAI_MODEL` isteğe bağlıdır; varsayılan `gpt-6-luna` değerini hesabınızda erişebildiğiniz modelle değiştirebilirsiniz. `.env` Git tarafından yok sayılır; anahtarı `VITE_` önekli bir değişkene, koda veya istemci uygulamasına koymayın. Anahtar eksikse yeni analiz 503 hatası verir; önceden saklanan analizler yine okunabilir. İstek ham HTML/CSV yerine kayıtlı koşu, at, jokey ve eşleşmiş idman alanlarını kullanır; yanıt at isimlerine karşı doğrulanır. Girdi 750 KB, model çıktısı 10.000 token ile sınırlandırılmıştır. Gerçek ücret seçilen modelin güncel token tarifesine ve gönderilen veri miktarına bağlıdır; OpenAI kullanım/bütçe limitlerini ayrıca ayarlayın.

`/api/history/health` yarış, at, entry ve ham kaynak snapshot sayılarını verir. `source_snapshots` tablosu CSV, meeting kimlikleri, idman tabloları ve performans tablolarının checksum’lı kopyalarını saklar. TJK’nın bazı sayfaları anlık `403/504` verebildiğinden her istekte `failures` alanı kontrol edilmelidir. Resmi API anahtarı varsa API sürecinde `TJK_AUTH_KEY` ortam değişkeni olarak verilebilir; anahtarı `.env` dosyasına ya da istemci uygulamasına koymayın.

Canlı veri adaptörü için `.env.example` dosyasını `.env` olarak kopyalayıp JSON dönen bir endpoint tanımlayın:

```bash
VITE_RACE_API_URL=https://api.example.com/races/today
```

Endpoint şu formatı döndürmelidir: `{ "races": [ ... ] }`. TJK erişimi başarısız olduğunda istemci tarafında uydurma/demo yarış üretilmez; backend hata ve başarısız kaynakları raporlar.

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

Canlı ingest AGF’yi ham kaynak olarak saklar, ancak baseline skorunda kullanmaz. At geçmişi, jokey istatistiği ve idman verisi SQLite’a yazılır. Günlük OpenAI çıktısı nitel aday sıralaması ve risk notudur; kalibre edilmiş kazanma yüzdesi değildir ve mevcut baseline/kupon hesabını değiştirmez. Bu verileri skora ve kupon optimizasyonuna bağlamadan önce zaman bazlı backtest ve olasılık kalibrasyonu gerekir. Mevcut skor eğitilmiş bir makine öğrenmesi modeli değildir.

Sonraki teknik adımlar: TJK veri erişim katmanı, geçmiş yarış veri modeli, model servisinin API olarak ayrıştırılması, oran kalibrasyonu ve kullanıcı kupon geçmişi.
