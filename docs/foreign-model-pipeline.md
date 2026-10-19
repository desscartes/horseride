# Yurtdışı verisi ve eğitim

Türkiye modeli yurtdışı koşularına uygulanmaz. Türkiye eğitim ihracatı ve idman taraması yalnız yerli kayıtları kullanır. TJK yurtdışı arşivi yalnız Türkiye'de programlanan toplantıları içerir; tam kariyer kaydı değildir.

## Tekrarlanabilir süreç

1. `node --use-system-ca server/collect-foreign-history.mjs 365 2026-10-04`
2. `node --use-system-ca server/collect-equibase-charts.mjs`
3. Projedeki Python ile `server/parse-equibase-charts.py data/external/equibase`
4. `node server/enrich-equibase-history.mjs`
5. `node --use-system-ca server/enrich-hkjc-history.mjs`
6. `node server/export-foreign-training.mjs`
7. Projedeki CatBoost Python ortamıyla `server/train-foreign-ranking.py`

Toplayıcılar tekrar çalıştırılabilir. Günlük hatalar ve tamamlanmamış koşular kayda alınır. Bir günün bazı toplantıları eksikken elde edilen geçerli koşular atılmaz. Yarışa katılmadığı programda doğrulanan atlar sonuç eşleşmesinden çıkarılır; diğer eksik sonuçlar uydurulmaz.

HKJC'deki yarış numarası TJK'dekiyle aynı olmayabilir. Resmî toplantı tarihi, tam at alanı ve bütün bitiriş sıraları eşleşmeden dereceler eklenmez. Equibase'de tarih, hipodrom, tam at alanı ve kazanan doğrulanır; belirsiz veya birden fazla eşleşme reddedilir. Ham kaynaklar ve kaynak URL'leri korunur.

## Eğitim ve sınırlar

Her ülkenin at, jokey, antrenör ve ortaklık geçmişi ayrıdır. İlk 60 takvim günü geçmiş oluşturur. Sonraki tarihler sıralı eğitim/doğrulama/test bölümlerine ayrılır. Aynı gün veya sonraki gün sonuçları önceki yarışın özelliği olamaz. Model derinliği ve sıcaklık yalnız doğrulama setinde seçilir; kapanış oranları yalnız kıyaslama için kullanılır. Ülke modeli ancak en az 300 test koşusunda, temel modele göre en az 2 puan birincilik artışı, gün bazlı bootstrap güven aralığının pozitif alt sınırı, daha düşük Brier ve düşmeyen ilk üç kapsamıyla canlı denemeye alınır. Bu koşulları şu an yalnız ABD sağladı. Fransa, İngiltere ve Güney Afrika deneyleri etkin değil; Türkiye modeli bu ülkelere aktarılmıyor.

Equibase PDF'lerinden elde edilen yarış içi konum, trafik yorumu, pist/hava ve ikramiye kanıtları **yarış sonrası** veridir. Yalnız daha sonraki tarihlerdeki yarışların geçmiş özelliklerine eklenir. Hedef yarışın sonuç çizelgesi o yarışın tahmininde kullanılamaz. ABD'de bu ek kaynak şimdilik Gulfstream Park ile sınırlıdır; tüm ABD pistlerine genellenemez.

Boş veya sabit özellikler eğitimden çıkarılır. Yurtdışında idman ve yarış öncesi hava kapsamı sıfırsa bu alanların öğrenildiği söylenemez. Küçük test örnekleri ayrı işaretlenir. Model puanları gerçek kazanma olasılığı veya kuponun tutma oranı değildir.

## Kaynaklar

- TJK: resmî tarihli program CSV ve sonuç sayfaları.
- Equibase: ücretsiz sonuç PDF'leri: https://www.equibase.com/products/whatisfullcharts.cfm . Makineye hazır hız/sınıf puanlı CSV/XML ücretlidir: https://www.equibase.com/products/whataredownloadablecharts.cfm . Ücretli veri alınmadı.
- HKJC: https://racing.hkjc.com/en-us/local/information/localresults ve resmî ara derece sayfaları. Derece, yarış içi konum, farklar ve kayıt kimlikleri erişilen sonuçlardan doğrulanabilir.
- France Galop: https://www.france-galop.com/fr/calendriers ve resmî tracking PDF'leri incelendi; geniş tarihsel entegrasyon henüz yok.
- BHA: https://www.britishhorseracing.com/racing/results/ otomatik erişimde engellendi. PMU servisinde TLS/bağlantı sorunu görüldü. Engeller aşılmadı, bu kaynaklar tamamlanmış entegrasyon sayılmaz.

Öncelikli kalanlar: daha uzun ve tam kariyer geçmişi, tarihli idman, yarış öncesi hava tahmini ve rüzgâr, güncel pist durumu/rail, karşılaştırılabilir hız-sınıf ölçüleri, tempo/ara dereceler, trafik raporu, ekipman ve kilo değişimleri, son dakika çıkışlar. Sağlık ve ahır içi durum gibi kamuya açık olmayan bilgiler varmış gibi kullanılmaz.

## Yakın tarihli ABD idmanları
node --use-system-ca server/collect-equibase-workouts.mjs dört hipodromun resmen bağlantı verilen idman sayfalarını toplar. 32 sayfada 1189 kayıt, 2026-09-26–2026-10-05. Kaynak: https://tvg.equibase.com/static/workout/index.html . At adı, yaş ve tekil kayıt kimliği doğrulanır; aynı gün ve gelecek idmanlar dışlanır. Kaynak furlong mesafesi korunur; olmayan ara dereceler üretilmez. Bu yakın dönem eğitim bölümünü kapsamadığı için sayısal modelde idman katkısı öğrenilmiş sayılmaz. Eşleşen güncel kayıtlar yorum kanıtıdır; workoutsUsed false kalır.

## Genişletilmiş deney ve sürümlü girdiler

5 Ekim: 240 PDF, 2116 çizelge, 1741 eşleşmiş yarış, 12475 at satırı. GP, IND, FL, PRX. `FOREIGN_MODEL_DIR=data/foreign-models-expanded` ile ihracat, eğitim ve `audit-foreign-model.py` ayrı dizinde çalıştırılır. ABD deneyi ilk aday %25.37, ilk üç %59.99, Brier .82289; aktif model %25.93 / %60.13 / .82078. Yeni deney mevcut modele göre kötü olduğu için kapalıdır. Aktif US-report.json externalChartsPath ile parsed-v1.json girdisini sabitler. İdman arşivi birikimli tutulur; ABD programında altı saatte bir yenilenir. Kontrol edilen 16 eski idman URL'si 404 verdi. Test dönemi tekrar incelendi; geliştirmeler için canlı yeni yarışlarla doğrulama gerekir.

Sunucu ortamı runtime-env.mjs üzerinden proje .env dosyasından yüklenir; süreç değişkenleri önceliklidir. /api/health aiConfigured boolean verir, gizli değer vermez.


## Performance v1 / APK 1.6 (2026-10-06)

17 normalized speed/class/connections/pedigree features are appended only for performance_v1 metadata. Per-day references exclude same and future dates. US v3 passed the incumbent day-bootstrap gate and is enabled prospectively; TR v3 remains shadow-only. FR/GB/ZA candidates remain held. Reproduce with PERFORMANCE_FEATURES=1 exporters, train-foreign-ranking.py, verify-performance-models.mjs, then activate-performance-us.mjs. Frozen Equibase input is parsed-performance-v3.json (GP/IND/FL/PRX). Runtime additionally archives pre-race regional Open-Meteo forecasts, dated TJK steward evidence, and observed-date-gated HKJC health/trackwork. These new qualitative inputs are not claimed as learned weather/health effects. Detailed metrics and limitations are in the v1.6 output report.


## v1.7 / geniş tarihsel veri (2026-10-07)

TR: 2025-07-07–2026-10-04, 455 gün/7691 yarış; 90 eski gün ve idman sayfaları tamamlandı. IDENTITY_VERSION=2 ayrı SGKR/YP/BB ve AP eklerini eşleştirir; çelişkili registry adları kör birleştirilmez. Sabit doğrulama/test bölümleri ile ana TR modeli %25.22→%27.92, ilk üç %57.83→%59.32; +2.70 puan, gün-bootstrap [.59,4.74]. İleriye dönük deneme aktif; tekrar incelenmiş testtir.

Equibase 501 PDF / 4515 yarış / 33470 satır, 14 fiili pist; 3691 tam alan eşleşmesi / 27179 koşucu. 156 eski toplantı 404, doldurulmadı. İdman birikimli 4807 kayıt / 12 pist, Sep26–Oct06; katkısı sayısal eğitimle doğrulanmış değil. v2 PDF parser ayrı baseline karakterlerinden konum alır; üst simge farkları dışlar. 9 pace özelliği sadece önceki gün çizelgelerini kullanır. US v4 aday %27.40/%61.95, aktif v3 %28.17/%63.00; aday kapalı ve shadow_data grubunda kaydedilir. Nitel ara konum özeti güncel AI yorumunda ve uygulamada görünür.

Tekrar üretim: ARCHIVE_THROUGH_DATE=2026-10-04; PERFORMANCE_FEATURES=1; IDENTITY_VERSION=2; FOREIGN_MODEL_DIR=data/foreign-models-next. US için PACE_FEATURES=1, TRAIN_COUNTRIES=US; TR için export-training.mjs çıktısı TR-training.json olarak country TR ile kaydedilir. Eğitim FIXED_SPLITS_DIR=data/foreign-models-performance; US incumbent dizini data/foreign-models-performance. verify-next-models.mjs tam 75/91 canlı özellikleri, JSON tahminini ve lideri karşılaştırır. activate-next-models.mjs geçiş kriterlerini zorunlu kılar, TR öncesini data/models/before-performance-v4 altında saklar. Aktif TR trainingDataPath/testModelPath ile sürümlü girdilere bağlanır; US v3 girdisi korunur. shadow_data ana kuponları değiştirmez; yeni TR expanded ailesi eski workout/weather kayıtlarıyla birleştirilmez.
