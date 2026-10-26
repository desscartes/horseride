# HorseRide — model ve arayüz denetimi, 26 Ekim 2026

Bu rapor aktif modeller, kayıtlı yarış öncesi tahminler, eğitim çıktıları, günlük veri kapsamı, çalışan servisler ve gerçek web arayüzü üzerinden hazırlanmıştır. Aktif model değiştirilmedi; yeni eğitim, ücretli veri alımı veya geçmiş tahminlerin yeniden yazılması yapılmadı. Sayılar belirtilen anın görüntüsüdür; gün içi sonuçlar ve çekilenler paydaları değiştirebilir.

## 1. Sonuç

Mevcut veriler güvenilir bir altılı öneri sistemi iddiasını henüz desteklemiyor. Aynı 589 yarışta modelin ilk atı %29,88, yarış öncesi piyasa favorisi %34,80 kazanmış. Model yalnız ilk at isabetinde değil, olasılık hatasında da piyasanın gerisinde. Daha çok veri toplamak tek başına yeterli olmamış: bugünün Türkiye ve ABD adayları mevcut modelden daha düşük ilk at isabeti üretmiş ve doğru olarak terfi ettirilmemiş.

Ayrı bir kritik sorun servis sürekliliği: sabit dış URL çözümü var; ancak içeride ana API zaman aşımına girince rapor, simülasyon ve şehir programı yine aksayabiliyor. Tünelin çalışması uygulamanın bütün akışlarının sağlıklı olduğunu göstermiyor.

## 2. Gerçekte kullanılan modeller

| Ülke | Aktif sistem | Eğitim sonu | Seçili / ağaçlarda kullanılan özellik |
|---|---|---|---|
| Türkiye | local_catboost_performance_TR_v4, performance_v2 | 4 Ekim 2026 | 72 / 54 |
| ABD | local_catboost_performance_US_v3, performance_v1 | 4 Ekim 2026 | 52 / 36 |
| İngiltere, Fransa, Güney Afrika, Avustralya | Doğrulanmış aktif ülke modeli yok; temel puanlama | — | Aday bulunması aktif model bulunduğu anlamına gelmez |

Türkiye aktif modeli idman sayısı, yakınlığı, 400/800/1000 dereceleri, 400 ortalaması/eğilimi ve aynı pistte çalışma gibi alanları gerçekten kullanıyor. Her iki aktif model jokey galibiyet oranı, son 30 gün jokey oranı, at-jokey birlikteliği ve antrenör alanlarını kullanıyor. Dolayısıyla “jokey/idman hiç dikkate alınmıyor” genellemesi doğru değil.

ABD aktif modelinde idman alanı kullanılmıyor. Bugün idman kaydı toplanması, bu alanın eğitimde öğrenildiği anlamına gelmiyor. Tarihsel parametre öğrenme döneminde yeterli idman olmadığı için ilgili deney bloke edilmiş. Günlük eğitim çalışmış olsa da aktif modelin eğitim sonu kendiliğinden ilerlemiyor; terfi koşulları sağlanmalı.

## 3. Ölçülmüş başarı

Kaynak: data/maintenance/probability-quality-2026-10-26.json, 11:58 Türkiye saati. Başlangıç 7 Ekim; 18 günde 709 sonuçlanmış, uygun yarış. 66 alan/kimlik uyuşmazlığı ve 110 sonuç bekleyen kayıt dışarıda. Doğrulanmış yarış öncesi model kaydı olmayan 28.561 yakalama değerlendirmeye alınmamış; bu sayı ayrı yarış sayısı değildir.

| Aynı yarış kümesi | Yarış | Model ilk at | Piyasa ilk at |
|---|---:|---:|---:|
| Toplam eşleşmiş | 589 | %29,88 | %34,80 |
| Türkiye eşleşmiş | 284 | %30,28 | %33,45 |
| ABD eşleşmiş | 305 | %29,51 | %36,07 |

Eşleşmiş toplam Brier: model 0,80315, piyasa 0,77434; log loss: model 1,84872, piyasa 1,76108. Bu iki ölçütte düşük değer daha iyi. Eşleşme şartı aranmayan 709 yarışta model ilk at isabeti %29,62. Farklı örneklemleri birbirine karşı üstünlük kanıtı olarak kullanmamak gerekir.

12 ve üzeri atlı yarışlarda isabet %18,03; 2–7 atlılarda %37,25. Modelin en yüksek güven grubunda yalnız 21 yarış var; bu örneklem güçlü banko veya kalibrasyon kanıtı sayılmaz. Ayrı prospective-report dosyasındaki 302 TR / 444 US paydaları farklı uygunluk kuralları kullanıyor; rapor ekranında bu fark açıklanmalı ve ortak ölçüm sözleşmesi kurulmalı.

### Kuponlar

Kaynak: coupon-quality-2026-10-26.json, 11:56 Türkiye saati. 715 kayıt, 649 sonuçlanmış kupon, 23 tutan: %3,54. Türkiye 245/5 (%2,04), ABD 404/18 (%4,46).

| Bütçe grubu | Sonuçlanmış | Tutan | İsabet |
|---|---:|---:|---:|
| 30 TL | 145 | 2 | %1,38 |
| 50 TL | 147 | 3 | %2,04 |
| 1.000 TL geniş | 151 | 16 | %10,60 |
| 100 TL, eski/global kayıtlar | 196 | 2 | %1,02 |

Bunlar birbirinden bağımsız deneyler değildir; aynı ayakları paylaşabilirler. Geniş kuponun daha yüksek isabeti daha fazla kombinasyon satın almasından etkilenir. Aynı bütçeli piyasa ve basit referans kuponla karşılaştırma, doğrulanmış ikramiyeler ve net getiri olmadan model üstünlüğü veya kârlılık sonucu çıkarılamaz. Global 100 TL ve eski kayıtlar, şehir kartlarından kaldırılan 100 TL seçeneğinin geri geldiği anlamına gelmez.

## 4. Bugünkü veri açıkları

Kaynak: current-runner-gaps-2026-10-26.json, 10:00 Türkiye saati. Aşağıdakiler eksik kayıt sayılarıdır; sonradan çekilen atlarla güncel toplamlar azalabilir.

| Alan | TR / 180 at | US / 263 | GB / 173 | FR / 94 |
|---|---:|---:|---:|---:|
| Önceki yarış geçmişi | 22 | 53 | 49 | 25 |
| Bireysel derece | 22 | 195 | 161 | 94 |
| İdman kaydı | 4 | 145 | 173 | 94 |
| Anne babası | 89 | 172 | 102 | 0 |
| Jokey performansı | 4 | 13 | 10 | 10 |
| 10 starttan az jokey örneği | 7 | 85 | 22 | 19 |
| Güncel pist durumu | 180 | 263 | 173 | 94 |

Temel ebeveyn, jokey/antrenör adı, kilo, start ve ikramiye alanları bu görüntüde dolu; doluluk kimlik doğruluğunu veya kaynak güncelliğini tek başına kanıtlamaz. Önceki yarış olmaması doğrulanmış ilk start için doğal olabilir; “ilk start”, “kaynakta yok”, “henüz toplanmadı” ayrı durumlar olmalı.

14:11 civarındaki daha sıkı 90 günlük idman denetiminde TR 179 aktif atın 173'ünde kayıt, 172'sinde dereceli kayıt; US 263 atın 118'inde kayıt var. Farklı zaman/pencere nedeniyle sabah tablosuyla aynı payda değildir. İngiltere/Fransa idman kapsamı bu kontrolde de sıfır. Bugün AU/ZA programı olmaması program kaybı sayılmadı. Avustralya kaynak doğrulama engeli korunuyor; korumayı aşmak çözüm değildir.

### Eğitim ile canlı veri arasındaki fark

Eğitim kanıt denetiminde ABD idman doluluğu fit döneminde %0,4, testte %67,4; kişisel hız yaklaşık %20,4 → %24,3; tarihli hava %0 → %0. Türkiye anne-babası doluluğu %29,5 → %68,9, ikramiye %64,9 → %100. Kaynak kapsamındaki bu büyük farklar, canlıda yeni bulunan alanların geçmişte aynı şekilde öğrenilmediğini gösteriyor. Türkiye tarihsel hava doluluğunun yüksek olması bugünkü resmî pist durumunun dolu olduğu anlamına gelmez.

## 5. Adaylar, jokey etkisi ve kanıt sınırı

26 Ekim sabah eğitim raporunda TR aday ilk at %27,85 / mevcut %30,77 (377 yarış); US %27,63 / %29,57 (514 yarış). Bazı olasılık hata ölçüleri iyileşse de ilk at performansı geriliyor. GB/FR/ZA bazı geçmiş testlerde olumlu; AU ve TR Arap alt modeli olumsuz. Bu geçmiş testler tekrar kullanıldığından yeni bir bağımsız gelecek testi yerine geçmez.

Jokey deneyi TR doğrulama kümesinde ilk atı %28,37'den %29,80'e çıkarıyor ve olasılık hatasını azaltıyor. ABD'de %26,84 → %27,83, fakat Brier ve log loss kötüleşiyor. Bu nedenle jokey etkisinin canlı başarıyı artırdığı henüz kanıtlanmış değil; sadece ilk at artışına bakıp terfi yapılmamalı. Jokey oranları örnek sayısı, rakip seviyesi, binilen at kalitesi ve son tarih ile birlikte kullanılmalı.

17 Ekimde sabitlenmiş ileriye dönük adaylar: TR 138 eşleşmiş yarış/8 gün (%28,26 aday / %26,81 mevcut); US 180/8 (%26,11 / %28,89); TR Arap 59/8; TR İngiliz 79/8. Hiçbiri 300 yarış ve 21 gün eşiğine ulaşmış değil.

Eğitim sözleşmesi ve Python/Node sayısal eşitlik kontrolleri mevcut. Runtime doğrulaması artefakt başına tek referans koşuyla sınırlı; ilk start, eksik veri, çekilen at, jokey değişikliği ve ülke çeşitleriyle genişletilmeli. Bunların geçmesi bütün kaynakların yarış öncesi yayımlandığını veya doğruluk artışını tek başına kanıtlamaz. Mevcut terfi kapısı korunmalı: bağımsız yarış öncesi eşleşmiş değerlendirme, örnek eşiği, güven aralığı, ilk üç ve olasılık hatası koşulları.

## 6. Sabah hazırlığı ve servis bulguları

Sabah işi 09:00'da başlamış, ilk program toplama 09:08, ikinci yenileme 09:42; eğitim 13:48, genel bitiş 13:52 ve sonuç partial. Bursa/Şanlıurfa yorumlarının bir bölümü ve bazı yabancı toplantı işleri zaman aşımına uğramış. 12:05 hazırlık raporunda programFresh=false; ilk Bursa koşusunda temel alanlar ve jokey bilgisi hazır ama dataComplete/predictionAvailable/servingReady=false. “Her şey ilk yarıştan önce hazır” iddiası bu kanıtla verilemez.

14:08 civarında yerel yayın geçidinde sağlık 502 / 5,0 sn; simülasyon, rapor ve toplantılar 502 / 15,0 sn. Buna karşılık önbellekteki Şanlıurfa kuponu 200 / 82 ms. Supervisor üç başarısız kontrolden sonra kendine ait API sürecini yeniden başlatıyor; günlükte program yenileme ve yorum önbelleği zaman aşımları var. Bazı akışlar sonra toparlandı. Kesin kök neden henüz kanıtlanmadı; SQLite beklemesi, senkron hesaplama ve arka plan yükü süre ölçümüyle ayrılmalı. Sadece tüneli yeniden başlatmak içerideki bu sorunu çözmez.

## 7. Arayüz denetimi

Canlı üretim arayüzü gerçek yerel geçitten mobil 390×844 ve masaüstü 1366×900 Chrome ile kontrol edildi. Kişisel tarayıcı oturumu veya telefon yönetilmedi. Yapay veri kullanılmadı; yeni yorum/eğitim başlatacak yazma istekleri gönderilmedi.

Doğrulananlar: beş ana sekme mevcut; incelenen ekranlarda yatay taşma yok. Şanlıurfa için iki resmî altılının her birinde 30 / 50 / geniş kartları ve ayak sürprizleri var. Örnek ilk altılı 30 TL, 48 TL ve 960 TL; tahmini oranlar kalibre edilmediği notuyla gösteriliyor. Güncel Şanlıurfa yorumunda 24 Ekim idmanı, 400/600 derece ve jokeyin 90/30 günlük sayımları görülüyor. İlk start ile doğrulanmamış geçmişi ayıran açıklamalar var. Bunlar tamamen yok sayılmamalı.

| Öncelik | Bulgu | Gereken davranış |
|---|---|---|
| P0 | Ana API aksayınca rapor/simülasyon/toplantı isteği 502; rapor son mobil kontrolde 18 sn sonra hâlâ yükleniyor | Her ekranın son başarılı görüntüsü, kaynak zamanı ve hatası ayrı; uzun işlerden bağımsız hızlı okuma uçları |
| P1 | Şehir seçilirken seçenekler varken Bursa/Chantilly kısa süre 0 koşu ve “sürpriz için yeterli at yok” gösteriyor | Yükleniyor, gerçekten boş, başarısız ve eski kayıt durumlarını ayır; yüklenirken yokluk sonucu üretme |
| P1 | “Program güncel” ile veri kapsamı/hazırlık karışabiliyor | Kaynak yenilenme saati, önbellek yaşı ve yarışın hazır olma durumunu ayrı göster |
| P1 | “At geçmişi” geçmiş sonuç izlenimi veriyor | Şimdiki içerik “Kaydedilmiş program/tahmin geçmişi” diye adlandırılmalı; gerçek bitirişli performans ayrı bölüm olmalı |
| P1 | Yorumda çok veri ve uyarı var; birinciliğin rakibe göre gerekçesi hâlâ zayıf | Kısa iki avantaj, bir risk, en yakın rakiple karşılaştırma; açıklama gerçek sıralama girdileriyle uyumlu |
| P1 | Yabancı temel puanlama ve doğrulanmış ülke modeli karışabilir | Model adı/sürümü, ülke kapsamı ve tahminin türü görünür olmalı |
| P1 | Kupon olasılığı kalibre edilmemiş; zayıf tek seçim geniş kuponda da kalabiliyor | En kırılgan ayak, bütçe artışının kapsama katkısı, doğrulanmış başarı aralığı; garanti banko dilinden kaçın |
| P2 | Simülasyon sayfası yaklaşık 11.418 piksel: bütün günler/kuponlar açık | Bugünü öne al, haftalık özet ve kapanabilir eski günler; üstteki tarih kontrolüyle ilişkiyi netleştir |
| P2 | Sosyal kart gerçek oynanma sayısını ölçmüyor | Kaynak sayısı, tarih ve erişilen paylaşım kapsamı; ölçülmeyen popülerliği iddia etme |
| P2 | Veri skoru / göreli puan / AI sırası beraber kullanılıyor | Her birinin anlamı ve seçilen sıralama açık; veri doluluğu kazanma ihtimali gibi okunmamalı |

At geçmişi bulgusunun kod kanıtı: server/database.mjs findHorseHistory(), race_entries/races birleşiminden probability/independentScore ve program alanlarını getiriyor; bitiriş sonucu döndürmüyor. İsim LIKE eşleşmesi de farklı isimlerin karışması açısından kalıcı at kimliğiyle değiştirilmesi gereken bir risk.

## 8. Uygulama sırası ve kabul koşulları

1. **P0 — Servis sürekliliği.** İstek/iş/SQLite sürelerini ve kuyruk yaşını ölç; ağır rapor/analizleri okuma servisinden ayır; tarihli önbellek ve tekil iş kilitlerini koru. Kabul: yük altında sağlık, program, kupon, rapor ve simülasyon için süre/hata oranı ölçülmüş; restart döngüsü yok ve kopuklukta eski veri açıkça etiketli.
2. **P1 — Yarışa göre hazırlık takvimi.** Ülkeye göre erken başla; program keşfi, at verisi, hava/pist, değişiklikler ve yorum ayrı süre sınırlı işler olsun. İlk yarıştan 60/30/10 dk önce kapsama kontrolü; sonuç sonrası veriler geçmiş tahmine yazılmasın. Kabul: her koşunun son kontrol zamanı, eksik nedeni ve son hazır olma zamanı kayıtlı.
3. **P1 — Verinin doğruluğu ve kapsamı.** TR pist durumu ve anne-babası; US bireysel derece/tarihsel idman; GB/FR kişisel performans ve uygun ücretsiz kaynaklar öncelikli. Kaynak yayımlanma/alınma zamanı, at kimliği, mesafe/pist ve boşluk nedeni saklansın. Kabul: kritik alanlarda kapsam ölçülür; erişilemeyen kaynak dürüstçe ayrı, ilk start yanlış eksik sayılmaz.
4. **P1 — Güçlü performans özellikleri.** Kazananın derecesini bütün atlara kopyalamadan bireysel hız, pist/mesafe/sınıf düzeltmesi, tempo/ara dereceler, start etkisi ve yarış içi trafik; ardından dinlenme, antrenör değişimi, ilk start denemesi ve hazırlık düzeni. Jokey/at/jokey-antrenör oranlarını küçük örneklerde genel ortalamaya yaklaştır. Kabul: her grubun kaynağı ve zaman güvenliği bilinir; tek tek çıkarma deneyiyle ek katkısı ölçülür.
5. **P1 — Bağımsız değerlendirme ve kalibrasyon.** Tarih sıralı, yeniden kullanılmayan test; aynı yarış ve bütçede piyasa, mevcut model, basit referans ve aday karşılaştırması. Ülke/at sayısı/ilk start ayrımı; gün bazında güven aralığı. Kalibrasyon ve olası piyasa-model birleşimini yalnız önceki dönemle öğren. Kabul: mevcut terfi kapıları geçmeden canlı model değişmez.
6. **P1 — Kupon seçimi.** Her resmî altılıda maliyet sınırı altında aday kombinasyonlarını karşılaştır; düşük güvenli tekleri ve çekilenleri yeniden kontrol et; 30/50/geniş için aynı bütçeli referans isabeti ve resmî net getiriyi takip et. Kabul: “en yüksek” iddiası kullanılan arama ve olasılık varsayımlarıyla sınırlı; gerçek tutma oranı bağımsız kayıtlardan gösterilir.
7. **P1/P2 — Arayüz anlamı.** Önce yüklenme/boş/hata, veri zamanı ve tarihçe adlandırması; ardından karşılaştırmalı yorum, kuponun kırılgan ayağı ve kısa simülasyon görünümü. Kabul: program yüklenirken 0 at sonucu üretilmez; kullanıcı sıralamanın dayanağını ve eksik kanıtı tek ekranda anlar.
8. **P1/P2 — Tekrar üretilebilir sürüm/test.** Üretim UI kaynakları ile eski src/Vite yapısını uzlaştır; şu an korumalı patch builder gerekiyor, doğrudan Vite build üretim özelliklerini kaybettirebilir. latest bağımlılıkları ve test komutu/CI düzenlenmeli. Kabul: temiz kurulum aynı ekranları üretir, testler canlı veritabanına dokunmaz, web+Android ağ senaryoları doğrulanır.

Bu sıralama bütün verilerin bulunacağını veya isabetin mutlaka artacağını garanti etmez. “Tamam” denebilmesi, kaynak bazlı eksik nedenlerinin çözülmesi ve bağımsız gelecekteki sonuçlarda ölçülmüş iyileşme gerektirir.

## 9. Testler ve sınırlar

86 test dosyası, 222 test: 221 geçti, 1 başarısız, iptal/atlama yok; yaklaşık 11,4 saniye. Başarısız test server/australian-form.test.mjs:43 eski “ilk yarış startına” ifadesini bekliyor; mevcut doğru ifade “ilk startına”. Bu dil beklentisi yenilenmeli; tek başına model arızası kanıtı değil. İlk varsayılan test koşusu canlı veritabanı yolunu kullandığından tamamlanmadı ve yalnız denetçinin kendi test süreçleri durduruldu. Nihai koşu her işçi için ayrı geçici SQLite ile yapıldı; CI için bu izolasyon kalıcılaştırılmalı.

Telefon üzerindeki APK 1.39 kurulumu ve gerçek mobil ağ testi bu denetimde doğrulanmadı. Yabancı şehirlerin tümü için yüklenmiş son ekran testi tamamlanmadı; geçici boş ekran gözlendi. Rapor ekranının yüklenmiş içeriği son kontrolde doğrulanamadı. Bu yüzden uçtan uca her şey geçti denmiyor. Canlı performans rakamları kârlılık kanıtı değildir.

## 10. Yerel kanıt dizini

- data/maintenance/full-audit-2026-10-26/: API süreleri, mobil/masaüstü görüntüler, ui-observations.json ve ui-deep-observations.json.
- data/maintenance/full-audit-tests-isolated-2026-10-26.log: nihai test sonuçları.
- data/maintenance/probability-quality-2026-10-26.json; coupon-quality-2026-10-26.json.
- data/maintenance/current-runner-gaps-2026-10-26.json; workout-usage-2026-10-26.json; training-evidence-audit.json.
- data/maintenance/pinned-studies.json; morning-2026-10-26.json; preparation-readiness-2026-10-26.json.
- data/intelligence-models/2026-10-26/morning/training-report.json ve doğrulama çıktıları.
- data/experiments/jockey-2026-10-26-morning/; us-workout-2026-10-26-morning/.

Ham data dizini Git dışında tutulur. Bu rapor ölçümlerin tarihli özetidir; kişisel anahtar, token veya veritabanı yayımlanmaz.
