# 27 Ekim: beş öncelik ve ölçüm durumu

## 1. Piyasa destekli model
650 aynı yarışta ilk at: mevcut model %29,692; piyasa %34,154; sabit yarı yarıya birleşim %34,000. Brier: .804400 / .778999 / .780026. Birleşim mevcut modelden iyi; piyasaya karşı üstün değil. Bu geçmiş incelemesi bağımsız yeni test değildir. Aktif model değişmedi. Yeni yarış öncesi kayıtlarda ayrı `fixed-half-market-v1` gölge tahmin saklanıyor; sonraki raporda yalnız gerçekten kaydedilmiş gölge tahminler ayrıca değerlendirilecek. Ağırlıklar sonuçlara göre değiştirilmedi.

## 2. Yarış türleri
Olasılık raporuna handikap, maiden/ilk-starta uygun koşu, stakes, diğer/bilinmeyen ve pist kırılımları eklendi. Maiden koşu ilk start kanıtı değildir; veri yokluğu debut sayılmaz. Ayrı uzman model açmak için her alt grupta yeterli tarihli eğitim ve bağımsız test örneği gerekir. Küçük alt grupların yüksek yüzdesi üstünlük olarak sunulmayacak. Kırılım raporu çalıştırıldı; nihai rakamlar işlem bitince okunmalı.

## 3. Performans verileri
Mevcut özelliklerde pist/mesafe referanslı hız, sınıf/rakip, kilo değişimi, jokey/antrenör son30gün ve soy zaten var. Tamamlanan observed-load-v3: 5121 eğitim, 708 önceki doğrulama yarışı. Son30gün mesafe ve son7gün start eklenince ilk at %26,836 -> %27,825; ilk3 %64,548 -> %64,407; Brier .804914 -> .806545, logloss1.818806 ->1.824410. Sıralama kazanımı olasılık kaybını karşılamıyor; etkinleştirilmedi. ABD tarihsel idman boşluğu ve gerçek ara derece/tempo kapsaması hâlâ temel sınır. Yeni veri olmadan bunları tamamlandı saymak doğru değil.

## 4. Jokey-at-antrenör
180 günlük aynı jokey/antrenör ortak start, küçültülmüş kazanma oranı, aynı atla ortak start/kazanma ve eksiklik göstergeleri araştırma özellikleri olarak eklendi. Ülke ayrımı, gün öncesi kesim, kopya start temizliği ve bilinen bitiremeyen atlar korunuyor. Yeni `jockey-team-2026-10-27` deney işi ortak kilit arkasında sıraya alındı. Ana modelin özellik boyutu/değişken sözleşmesi değiştirilmedi. Eğitim sonuçlanmadan katkı iddiası yok; canlı/eğitim eşitliği ve ileriye dönük doğrulama gerekiyor.

## 5. Eşit bütçeli kuponlar
30/50/1000TL aynı üst bütçe karşılaştırmasının resmî sonuçlandırması eklendi. İlk kaydedilmiş kupon, altı ayak, tam katılımcı eşleşmesi, çekilen/değişen alan dışlama, maliyet ve model/piyasa kazanan kupon sayıları raporlanır. Yeni kayıtlara tam alan eklendi. Önceki6çiftte bu bilgi olmadığından sonuç karşılaştırması yapılmadı. İkramiye olmadan ROI hesaplanmaz. Otomatik prestart akışında rapor da çalışır. Yeterli bağımsız gün ve sonuç beklenir; farklı bütçeler ve örtüşen altılılar bağımsız örnek değildir.

## Yeniden değerlendirme
En güçlü mevcut referans piyasa. Öncelik, onu aşan kanıt bulmak; sırf algoritma değiştirmek değil. İlerleme ölçütleri: aynı yarış alanında logloss/Brier iyileşmesi, ilk at/ilk3 gerilememesi, ülke ve yarış türlerinde tutarlılık, aynı bütçede kupon başarısı, yarış öncesi canlı veri eşitliği. Veri eksikliğinin modelde açık işaretlenmesi, küçük örneklerin küçültülmesi ve düşük güvende önerinin sınırlandırılması korunmalı. Beş başlığın sonuç doğrulaması henüz tamamlanmadı; kaynak ve gelecek sonuç gerektiren işler açık.

### Tamamlanan yarış türü kırılımı (aynı alanlı eşleşmeler)
| Grup | Yarış | Model ilk at | Piyasa ilk at | Yarı yarıya birleşim |
|---|---:|---:|---:|---:|
| Maiden/ilk-starta uygun | 213 | %30,52 | %30,05 | %33,80 |
| Handikap | 101 | %30,69 | %28,71 | %28,71 |
| Diğer | 325 | %28,62 | %38,15 | %35,38 |
| Stakes | 11 | %36,36 | %45,45 | %45,45 |
Bu tabloda grup bazında en iyi görünen yöntemi seçip aynı tabloyu yeniden test sonucu diye sunmak seçim yanlılığı yaratır. Stakes örneği çok az. Ayrı uzman için tarihli eğitim/ileriye dönük doğrulama gerekir. Birleşim tüm gruplarda kazanç sağlamıyor.


## Kalibrasyon ve kuyruk takibi
- Ülke/model sürümü başına en az100önceki yarış/7gün ile günlük yürüyen sıcaklık kalibrasyonu eklendi. Aynı günün sonuçları topluca dışarıda bırakılır; farklı model sürümleri birbirinin fit verisini kullanmaz. Sabit aday sıcaklıklar1/.75/1.25/1.5/2. Sıralama değişmez.
-506yarış/13gün tanısal sonucu: logloss1.877585 ->1.880295; Brier .808383 ->.809928. İkisi de kötüleşti. Etkinleştirilmedi. Bu arşiv daha önce incelendi; yeni bağımsız ileriye dönük kanıt olarak sunulmaz. Sonucun gerçek yayımlanma zamanları yeniden kurulmadı.
- Ortak toplama kilidi korunarak bekleme kuyruğu eklendi: sabah/start hazırlığı öncelikli, normal işler sonra, araştırma sonra;30dk üstü bekleyenler en eski önce şeridine geçer. Çalışan iş kesilmez, miras alınmış çocuk kilidi kuyruğa girmeden korunur, ölü bekleyenler temizlenir. Eski süreçler eski kodla bitene kadar yeni sıra tam devralmış sayılmaz.
- Jokey/antrenör araştırması bu kontrolde hâlâ mevcut kapsam denetiminin kilidini bekliyor. Sonuç uydurulmadı. Bir sonraki karar yeni özellik deneyinin gerçek sonuçları ve ileriye dönük piyasa birleşimi kayıtlarıyla verilecek.


## Sonraki beş iş uygulaması — 27 Ekim
1. Jokey-team işi önceki PID9356 çalışmadığı doğrulanarak PID9280 ile yeniden sıraya alındı. Ortak kapının sahibi günlük bakım23928, eğitim soy aşamasında. Bakımda geçmiş alan/ikramiye toplama zaman aşımları var; araştırmanın tamamlandığı söylenemez.
2. Olasılık raporuna mevcut raceClass sözlüğüyle ayrıntılı sınıf ailesi kırılımı eklendi; koşullu, satış/claiming, allowance, sınıf numaralı koşular gibi diğer grubunun içi artık ayrı raporlanır. Yeni rapor çalıştırıldı.
3. maidenEvidence içine açık debutEvidence eklendi: unknown/verified_debut/observed_prior_start, çelişkili kariyer bayrağı, idman/soy/jokey kapsamı. Yeni ayrı kazanma modeli eğitilmiş değildir; doğrulanmamış kariyer eksi puan veya ilk start kanıtı sayılmaz.
4. Yeni kupon optimizasyonu tüm aktif atların geçerli puanı ve tekil adı/numarası olmadan çalışmaz. Önceden eksik puanlı atı filtreleyip kalan alanla kupon üretme açığı kapatıldı. Eski kupon geçmişi değiştirilmez. Bu giriş bütünlüğü kontrolüdür; tek başına olasılık kalibrasyonu veya başarı garantisi değildir.
5. Eşit bütçeli ileriye dönük kıyas otomasyonu mevcut; sonuç bekleyen örnekler tamamlanmış sayılmıyor. Yeni değişikliklerle243test geçti. Aktif model aynı kaldı; kaynak boşlukları ve deney sonuçları hâlâ açık.
