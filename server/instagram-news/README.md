# Instagram yarış dosyası akışı

`run-instagram-agent.mjs`, `data/instagram/agent-config.json` içindeki `editorial_news` modunda beş dakikada bir çalışır. Codex oturumuna veya ücretli yapay zekâ çağrısına ihtiyaç duymaz.

## Yarış öncesi içerik

- Türkiye toplantılarında her hipodrom için ayrı kaydırılabilir gönderi hazırlanır. **Her görsel bir koşudur**; etkin, hedef günden önce eğitilmiş yerel modelin ilk dört sırası ve bu atların doğrulanmış önceki koşu, idman veya yakın sonuç notları gösterilir. Doğrulanmışsa ilk iki arasındaki model puanı farkında öne çıkan girdi belirtilir. On koşuyu aşan toplantılar en çok on görsellik parçalara ayrılır. Eksik sıralama veya çekilen atla kart yayımlanmaz.
- ABD toplantılarında da her hipodrom için ayrı gönderi, koşu başına bir görsel hazırlanır. Etkin ABD modeli ve tarihli Equibase idmanları kullanılabilir. Başka ülkeye ABD modeli aktarılmaz. Karttaki kısa notlar kayıtlı veriden oluşturulur; yerel dil modeli tamamlanmadıysa bağımsız bir dil modeli yorumu gibi sunulmaz.
- Etkin ve tam kapsamlı model olmayan yabancı toplantılar için ayrı bir **geçmiş form karşılaştırması** yapılır: her koşuda son altı görünür sonuçtaki ilk üç bitiriş sayısı, karşılaştırma kapsamı ve koşu ortancası. En az koşuların üçte ikisinde yeterli geçmiş veri gerekir. Kalan koşular açıkça “geçmiş sonuç kapsamı yetersiz” diye işaretlenir. Bu kartlar model sırası veya gelecek sonuç tahmini olarak sunulmaz.
- Şehir, tarih, pist, mesafe, koşu saati ve kaynak zamanı görünürdür. Gece yarısını aşan yabancı koşularda ertesi gün tarihi ayrıca yazılır. Sayılar eksikse uydurulmaz; çekilen atlar karşılaştırma dışıdır.
- Resmî program en çok 120 dakika önce alınmış ve ilk koşuya en az 10 dakika kalmış olmalıdır. Güncel önbellek yoksa sosyal görev 07.00 TSİ sonrasında programı ayrıca yenilemeyi dener; erken saatlerde kaynak yenileme aralığı 45 dakikadır. Yayından hemen önce program, model ve gönderi içeriği tekrar doğrulanır.

## Yayın sıklığı ve denetim

- Tüm akış gönderileri arasında en az 45 dakika bırakılır. Günlük toplam üst sınır `maxFeedPostsPerDay` ile, Türkiye/model yabancı/geçmiş form üst sınırları kendi yapılandırma alanlarıyla belirlenir. Yakın başlayan hipodromlara öncelik verilir. 29 Ekim Cumhuriyet gönderisine ayrılmış sabah penceresi yalnızca o güne özgüdür.
- `publication.json` ve `manifest.json` aynı gönderinin tekrar yayımlanmasını önler. Kaynak, model, zaman veya Instagram bağlantısı doğrulanmazsa yayın durur ve sebep `data/instagram/agent-status.json` içine yazılır.
- Eski bütçeli kupon ve sürpriz Reels işlevleri `editorial_news` modunda çağrılmaz. Tarihî Reels örnekleri otomatik kuyruğa alınmaz.
- Kontrol: `node --test server/instagram-news/facts.test.mjs server/instagram-news/model-facts.test.mjs server/instagram-news/race-card-facts.test.mjs server/instagram-news/foreign-form-facts.test.mjs server/instagram-news/cadence.test.mjs`.
