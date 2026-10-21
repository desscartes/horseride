# Gün içi veri işleri

Windows görevi: HorseRide-Intraday-Collection. Her15dakikada tek uygun işi seçer; saatler Europe/Istanbul. Mevcut Windows kullanıcı oturumunda çalışır. Kurulum: server/install-intraday-collection.ps1. Gizli pencere ve düşük işlem önceliği kullanılır.

| İş | Türkiye saati |
|---|---|
| Tüm yayımlanmış ülke programları, çekilenler/güncel program |05,07,09,11,13,15,17,19,21,23:00|
| Aynı programın resmi anne soyu CSV eşleşmeleri |aynı saatlerde :15|
| Türkiye/ABD bugünkü atları için soy, en çok50kayıt |09'dan itibaren aynı saatlerde :30|
| Türkiye eksik idmanları, en çok60at |09'dan itibaren aynı saatlerde :45|
| ABD tüm resmi idman tesisleri |10,14,18,22:00|
| Tüm aktif atların eksik envanteri ve gözlenen yük araştırma alanları |10:30,18:30|

Her kök iş kendi kilidinden önce collection-gate.lock alır. Bekleyen kökler kendi kilidini tutmaz; sabahın bakım/eğitim alt işleri sahibi devralır. Eski çalışan süreçler de kontrol edilir. Her iş en çok2kez denenir, yeniden denemede en az30dakika beklenir.60dakikadan eski slotlar yığılıp uygulamayı boğmaz; sonraki planlı tur güncel eksiklere bakar. Kaynak429/403/cooldown politikaları korunur. Veri kaynağında olmayan bilgi uydurulmaz.

Durum: data/maintenance/intraday-YYYY-MM-DD.json; iş başına ayrı günlük. Tamamlanan iş yeniden açılmaz. Eğitim mevcut kilitli bakım hattında kalır, bu görev tekrar eğitim başlatmaz.

# Yeni veri/özellik değerlendirmesi

1. Gözlenen son30gün tamamlanmış yarış mesafesi toplamı: uygulandı, araştırma girdisi.
2. Gözlenen son7gün tamamlanmış yarış sayısı: uygulandı, araştırma girdisi.
3. Aynı koşudaki bilinen rakiplere göre mesafe yükü: uygulandı, araştırma girdisi.
4. İdman aralığı/yarış aralığı oranı: resmi yaş+isim eşleşmiş önceki idmanlardan; uygulandı.
5. Yukarıdaki geçmişlerin bulunmaması ayrı göstergeler; yokluk form düşüklüğü veya ilk start sayılmaz.
6. Yarış öncesi rüzgar/yağış tahminlerinin sayısal katkısı: mevcut tarihli arşiv genişletilmeli; henüz modele eklendi denmez.
7. Koşunun tempo baskısı: doğrulanmış önceki ara pozisyonlardan rakiplerin toplu temposu; mevcut bireysel tempo verisinden ayrı kontrollü deney gerektirir.
8. Start/yarış içi sorunlar: resmi raporda doğru atla ve olayla eşleşen kayıtlar gerekir. Doğrulanmamış olayı model girdisine dönüştürme.

İlk yük+idman aralığı deneyi: data/experiments/observed-load-v2;5121fit/708eski-validationyarışı, parentayarları sabit. Control top1%26.6949, yükadayı%28.1073; Brier .805186→.806412 ve logloss1.818674→1.823458kötüleşti. Python/Node skor farkı0. Aynı eski doğrulama kullanıldı, bağımsız üstünlük yok; aktif modele alınmadı. v1'de yaş alanı yokluğu nedeniyle idman eşleşmesi eksikti; v2bunu düzeltir. Model dosyaları yayına alınamaz; tam serving paritesi ve ileri dönem kanıtı ayrıca zorunludur.
