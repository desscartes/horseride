# Yerel yarış sıralaması ve ölçüm

AI servisi/modeli değiştirilmedi. Tarihsel veri toplama, eğitim ve geri testte ücretli AI çağrısı yoktur. Canlı sıralama Node içinde çalışır; Python yalnız yeniden eğitim içindir.

## Veri

- Kilo ekleri toplanır (`60 +0.2` → `60.2`); imkânsız/kararsız değer eksik işaretlenir, tahmin edilmez.
- Program yenilenince koşmaz atlar SQLite alanından çıkarılır. Kilo, jokey, alan, idman veya yerel model değişirse AI önbelleği yeniden değerlendirilir.
- Ekipman ekleri değişse de geçmiş at kimliği eşleştirilir; idman programdaki resmi at kimliği ve isimle doğrulanır.
- TJK arşivi: 2025-10-05–2026-10-04; 5.984 tam eşleşmiş koşu. İki tarihte bazı toplantı kaynakları eksik; toplama ilerleme dosyası bunları açıkça tutar.
- At bazında idman sayfası, yarış öncesi tarihler ve 400/600/800/1000m vb. çalışma süreleri ayrı tutulur. İdman süresi yarış derecesi değildir.
- Bursa 2026-10-05: 102 aktif atın tamamında idman geçmişi bulundu; 95 atın son idmanı son 30, 98 atın son idmanı son 90 gün içindeydi. Dört atın daha eski kaydı vardır; eski idman güncel hazırlık kanıtı sayılmamalıdır. Yarış geçmişi 98/102 attadır. Günlük program alınırken idman tamamlama arka planda başlar; AI isteği bu işi bekler.
- AI girdisi bütün geçmişi tekrar göndermek yerine en fazla 14 ilgili geçmiş yarış ve 8 idman içerir. Mesafe/pist özetleri iki yıllık erişilebilir geçmişten hesaplanır.

## Eğitim ve bağımsız test

Yerel CPU CatBoost sıralaması, sayısal özellikler kullanır. AGF ve kapanış oranı özellik değildir. Kapanış favorisi yalnız kıyas içindir. At geçmişi, mesafe/pist/hipodrom, rakip karşılaşmaları, geçmiş rakip HP düzeyi, jokey, antrenör, at–jokey birlikteliği, ağırlık ve start kullanılır. Hız özelliği önceki yarışta atın süresini o yarışın kazananına göre değerlendirir; farklı pistlerdeki ham süreyi doğrudan karşılaştırmaz.

İlk 60 gün geçmiş biriktirir. Eğitim: 2025-12-04–2026-06-04 / 2.900 koşu. Model ve olasılık sıcaklığı seçimi: 2026-06-05–2026-08-04 / 1.011 koşu. Dokunulmayan son test: 2026-08-05–2026-10-04 / 1.003 koşu. Aynı günün sonuçları hiçbir koşunun girdisine eklenmez.

- Kazanan ilk aday: temel %19,74 → yeni %24,63.
- Kazanan ilk üç adayda: temel %50,55 → yeni %57,23.
- Brier: 0,86755 → 0,84269 (düşük daha iyi).
- Eşleşmiş bootstrap farkı: +4,89 puan; %95 aralık +1,60…+7,78.
- Kapanış favorisi: %32,60. Yeni model henüz bu kıyası geçmiyor.

Terfi eşiği: en az 300 test koşusu, en az +2 puan, eşleşmiş bootstrap alt sınırı >0 ve daha iyi Brier. Eşik geçildiği için model etkinleştirildi. Sonra aynı hiperparametrelerle 4.914 koşuda canlı model eğitildi. Eğitimde kullanılan son tarih 2026-10-04; bu tarihe veya öncesine canlı model uygulanmaz. Yurtdışına Türkiye modeli uygulanmaz.

Bu ilk v1 deneyinde idman özellikleri kullanılmadı. Aşağıdaki v2 denemesi idman ve hava özelliklerini eğitime de ekler.

## İdman ve hava destekli v2 — APK 1.4

365 yarış tarihinin resmi TJK idman sorgusu bütün sayfalarıyla alındı: 47.833 satır; başarısız gün yok. Aynı kaydın tekrarı ayıklanır, at adı ekipman ekleri dışında tam eşleştirilir. Her koşu için yalnız o tarihten önceki ve son 90 gündeki idmanlar kullanılabilir. 58.958 at-yarış kaydının 54.358'inde güncel idman vardır. 5.891 koşuda resmi hava/pist kaydı, 5.714 koşuda geçerli sıcaklık ayrıştırılmıştır. Eksik bilgi ve hatalı süre tahminle doldurulmaz.

Yeni girdiler: son idmandan geçen gün; son 14/30 gündeki çalışma sayısı; 400/800/1000 metre süreleri ve süre değişimi; idman yüzeyi/hipodromu; sıcaklık, nem, yağış, pist durumu; atın ıslak pistteki ve benzer sıcaklıktaki önceki performansı. Her değişken ağaçta kullanılmak zorunda değildir; model seçtiği özellikleri raporlar. Bu deneyde idman grubunun özellik önemi %10,266, hava/geçmiş hava uyumu grubunun %5,258'dir. Bunlar nedensel katkı veya başarı yüzdesi değildir.

Aynı 1.003 koşuluk son dönem karşılaştırması:

- Önceki v1: ilk aday %24,63; kazanan ilk üçte %57,23; Brier 0,84269.
- İdman/hava v2: ilk aday %25,22; kazanan ilk üçte %57,83; Brier 0,83926.
- İdman çıkarılmış kontrol: ilk aday %24,73; ilk üç %57,43; Brier 0,84170.
- Hava çıkarılmış kontrol: ilk aday %25,52; ilk üç %57,53; Brier 0,84105.

Tam model doğrulama dönemindeki log loss ile seçilmiştir; testteki birincilik isabeti hava çıkarılmış kontrolden 0,30 puan düşüktür. Hava eklenmesinin birincilik bulmayı artırdığı iddia edilemez; tam modelin ilk üç kapsamı ve Brier skoru daha iyidir. Önceki v1'e fark +0,59 puan (6 ek kazanan); eşleşmiş bootstrap %95 aralık -1,10…+2,29. Artış henüz istatistiksel olarak kesinleşmedi. Bu dönem önceki sürümde de incelendiğinden yeni kör test olarak sunulmaz. Arşivdeki hava, resmi toplantı hava kaydıdır; tarihsel hava tahmini değildir.

Yeni sürüm, önceki modelden düşük olmayan ilk aday isabeti ve daha iyi Brier nedeniyle kullanıcının istediği yeni girdileri canlı sınamak üzere **deneme** olarak etkinleştirildi (`enabled=true`, `promoted=false`, `prospective_trial`). Güçlü terfi eşiği hâlâ +2 puan ve bootstrap alt sınırının pozitif olmasıdır; v2 bu eşiği geçmedi. Canlı sonuçlar eski sürümden ayrı ölçülür. Geri dönülebilir v1 dosyaları `data/models/v1` içinde korunur. AI modeli ve ücretli sağlayıcı değiştirilmedi.

APK 1.4 yeni sunucuyu kullanır; öğrenen model Android dosyasının içinde değil, mevcut yerel Node sunucusunda çalışır. Telefon bilgisayarla aynı ağda olmalı ve 8788 portundaki sunucu açık kalmalıdır. Uygulama seçili koşuda son 90 gün idman kapsamını ve hava/pist verisinin varlığını gösterir.

## Canlı izleme

`forecast_snapshots` tahmini bitiş anında, yalnız planlanan başlangıçtan önceyse kaydeder. Sonuç sonrası üretilen AI analizi buna dahil edilmez. AI ve sayısal model ayrı ölçülür. Son program değişikliklerinde eski tahmin ezilmez; yeni kayıt eklenir. Ölçüm her koşunun başlangıçtan önceki son kaydını kullanır. Program saati kesin bir üst sınırdır; yarış gecikmiş olsa da sonradan oluşan tahmin canlı teste eklenmez.

Sunucu çalışırken önceki günlerin bekleyen tahminleri resmi sonuçlarla otomatik eşleştirilir. Sunucu kapalıyken toplama gerçekleşmez. Sonuç verisi henüz yoksa başarı sıfır gösterilmez, bekleniyor gösterilir.

## Tekrar çalıştırma

Proje kökünde:

```powershell
node --use-system-ca --env-file-if-exists=.env server/collect-history.mjs 365 2026-10-04
node --use-system-ca server/collect-training-workouts.mjs
node server/export-training.mjs
python server/train-environment-ranking.py
node --test server/*.test.mjs src/data/analysisView.test.mjs src/data/ticketData.test.mjs
npm run build
```

Python CatBoost ve SciPy paketleri `.tools/ml-python` içinde yerel tutulur. Node sunucusu bu paketleri kullanmaz; `data/ranking-live.json` ve `data/ranking-report.json` dosyalarını okur. Tarihsel ham kayıtlar SQLite `historical_race_data` tablosundadır. Toplayıcı tamamlanan günleri atlar ve kaldığı yerden devam eder. Başarısız deney `data/ranking-experiment-report.json` içinde tutulur; etkin model ve raporu korunur. Sonuçlar görüldükten sonra aynı test döneminde tekrar tekrar özellik seçmek bağımsız doğrulama değildir; sonraki sürümler yeni ileri dönemle sınanmalıdır.

AI yanıtları koşu sayısı ve programdaki aday isimleriyle sınırlandırılmış JSON şemasıyla alınır. Tam ve doğrulanmış analiz parçaları `daily_ai_batches` içinde saklanır; bir parçanın bağlantısı kesilirse başarılı parçalar tekrar ücretli çağrı yapılmadan kullanılır.

## Sürüm doğrulaması

24 otomatik test, web derlemesi ve Android debug APK derlemesi başarılıdır. Python/Node test puanları arasındaki en büyük fark 0; Bursa 8 koşuda AI ilk dört sırası yeni modelle aynı ve tekrar çağrı önbellekten gelmiştir. AI bağlantısının ilk denemesinde ECONNRESET oluşmuş, tekrar denemede 8 koşu tamamlanmıştır. Arşivi yenile düğmesi başarı ölçümünü de günceller.
