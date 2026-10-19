# AI yorumunun hazır olma düzeltmesi — APK 1.18

10 Ekim 2026'da Ankara ve İzmir'de uygulama yorumları göstermiyordu. Geçmiş arşiv yenilenmiş, Ankara'nın üç ve İzmir'in bir koşusunun ilk dört aday sırası değişmişti. Önceki yorumun bu koşullarda kullanılmaması doğru davranıştır.

İki sorun düzeltildi: arşivin güncellenme damgası veya yeni satır eklenmesi çalışan analizi bütün olarak iptal etmiyor; gerçek model değişikliği ve koşu/at alanı değişikliği hâlâ iptal ediyor. Arşiv revizyonu değiştiğinde kayıt yalnız güncel sayısal modelin bütün adayları aynı sırada doğrulanırsa yeniden kullanılabiliyor. Yeni üretilen sonuç da sunulan programla yeniden doğrulanıyor.

Uygulama ilk hazırlık yanıtından sonra sorgulamayı bırakıyordu. APK 1.18, eksik seçili yorum için görünür durumdayken 10 saniyede bir yalnız hazır sonucu sorgular. Yeni ücretli işlem başlatmaz. Ağ kesintisi sorgulamayı sona erdirmez; hipodrom/tarih değişince eski bekleme kapanır.

Sunucuda Ankara 10 ve İzmir 8 koşunun dört adaylı açıklaması dış HTTPS API üzerinden doğrulandı. Webde Ankara 10/10 yorum, yenileme düğmesine basılmadan otomatik göründü. APK derlemesi geçti; fiziksel Android cihazında kurulum testi yapılmadı. APK SHA-256: `449847668194C83E87464FB4AFBD588C89EBC8CF29B6D7A2F5478739342484BC`.

## APK 1.19 — tekrarlayan hazırlık sorunu

1.18'de kupon ekranı hazırlık hatasını idle durumuna çeviriyor ve hata metnini göstermiyordu. 1.19 bekleyen 503 yanıtında yalnız GET ile dört dakikaya kadar hazır sonucu veya çalışan işi sorgular; hata kupon bölümünde de görünür. Başarılı yanıt seçilen hipodromu korur.

Sunucunun başarılı hazırlık girişimi yeniden program yayımlandığında 30 dakika boyunca tekrar hazırlığı engelliyordu. Başarılı girişim bekleme kaydını kaldırır; başarısız girişimler bir dakika bekler. AI açıklaması, koşu alanı eşleşiyorsa sunulan programdaki aday sırasını kullanır; arşive göre bağımsız sıralama yapıp yayındaki sıralamayla çelişmez. Son doğrulama ve gerçek koşu alanı/model değişikliği kontrolleri korunur.

Dört sunucu regresyon testi ve APK derlemesi geçti. Dış API'de Ankara 10/10 ve İzmir 8/8 hazır kayıt, webde Ankara'nın dört adaylı açıklaması ve hata durumundan tekrar denemeyle sonuç gösterimi doğrulandı. Fiziksel Android kurulum testi yapılmadı. SHA-256: 2A13B615347C30AEC9CD8FB55E5C7BE83400C2B0DED56433917F673CC8AEFD92.
