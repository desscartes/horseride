# Ganyan Zekâsı — yerel Instagram yayını

27 Ekim 2026: hesap bağlı, uzun süreli token CurrentUser DPAPI ile şifreli; otomatik yayın açık. Windows görevi `HorseRide-Instagram-Agent` beş dakikada bir çalışır. Codex açık olmak zorunda değildir. Bilgisayar, internet ve token sahibi Windows oturumu açık kalmalıdır. Token 26 Aralık 2026 20:44 TSİ tarihinde sona erer; ajan günlük geçerlilik kontrolü yapar. App secret saklanmaz. Görev kullanıcı oturumu olmadan çalışmaz.

## Yayın sıklığı ve içerik

Resmî program belli olduktan sonra, ilgili altılının başlamasına 24 saat ile 10 dakika kala paylaşılabilir. 30–60 dakika bekleme şartı kaldırıldı. Şehir başına günde bir paket, toplam en çok dört şehir paketi ve iki Reels. Her paket üç kart içerir: 50 TL üst bütçede kupon, modelin ilk adayı, uygun sürpriz adayı. İlk altılı başlamışsa henüz başlamayan resmî ikinci altılı değerlendirilebilir. Günlük sınırlar başarı iddiası değil yayın sıklığı tercihidir.

Doğrulanmış ülke modeli, denetlenmiş kapsam, temel program bütünlüğü ve geçerli at/puanlar zorunludur. İdman, anne babası, bireysel derece, pist durumu ve küçük jokey örneklemi gibi eksikler otomatik olarak tüm yayını durdurmaz; açıklamada alan ve at sayısı belirtilir. Tüm atların geçmişi bilinmeyen koşudan kupon oluşturulmaz; geçmişi bilinmeyen at ilk/sürpriz adayı yapılmaz. Veri uydurulmaz, model eğitim/kabul eşikleri gevşetilmez, model puanı kazanma olasılığı gibi sunulmaz.

Program en fazla altı saatliktir; start yaklaştıkça kaynak yaşı 60/20 dakikaya iner. Yeni resmî giriş kontrolü kayıtlı programın parmak izi ve zamanıyla bağlanır; kalan koşuların atları, jokey, kilo, çekilme, ebeveyn ve tarih bilgisi değişirse eski tahmin kullanılamaz. Programın hesaplanma saati korunur; yalnız kontrol saati ayrıca yazılır. Son yayın öncesi plan tekrar okunur; süre dolmuş seçim yayımlanmaz.

## Görsel, Reels ve Story

Mevcut yarış fotoğrafı, logo ve yerel HTML şablonlarından 1080×1350 karusel ile 1080×1920 dikey kartlar üretilir. Ücretli yapay zekâ çağrısı yapılmaz. `server/render-instagram-vertical.mjs` üç kartı FFmpeg ile 15 saniye, 30 fps, H.264/AAC MP4'e çevirir. Gerekli ücretsiz paket: `.venv/Scripts/python.exe -m pip install imageio-ffmpeg==0.6.0`. Müzik lisansı gerektiren ses eklenmez.

Gelecekteki uygun ve yayımlanmış şehir paketinin değişmeyen seçimi için otomatik Reels hazırlanır; API işlenmesi sonraki kontrolde sürdürülür. Hazırlık sırasında yarış geçerse yayımlanmaz. Story kartları da hazırlanır, ancak mevcut Creator hesap türünde Story API yayını desteklenmez. Business hesaba geçiş ve canlı yetki doğrulaması tamamlanmadan otomatik Story açık sayılmaz.

Medya kendi GitHub deposunun `instagram-media` dalında yalnız yayın dosyaları olarak tutulur. Sabit commit URL'si ve yerel/uzak SHA256 doğrulanır. Kimlik sabittir; token/metin loga veya Git'e konmaz. Yayın sonucu belirsizse otomatik tekrar POST yapılmaz; yayın defteri uzlaştırma ister. API'de doğrulanan media ID ve permalink kaydedilir.

## Veri açığı ve sonuç takibi

`audit-publication-needs.mjs` ülke başına eksik alanları, arşiv gün/yarış sayısını ve model durumunu raporlar. ABD için resmî Equibase idmanları, Türkiye/ABD için TJK pedigri/idman işleri devam eder. Şili için `collect-publication-country-backfill.mjs` her çalışmada önceki 365 gün içinden tek bir tamamlanmamış tarihi TJK resmî program ve sonuçlarından toplar. Ortak veri toplama kilidine uyar; başka işin kilidi kaldırılmaz. Ek yakın tarih toplama ve Concepción kaynak keşfi zamanlı işlere bağlandı. Concepción'un açık sayfaları okunabiliyor; idman/sonuç API'si erişimi reddetti, bu alanlar entegre edilmiş sayılmıyor.

Sonuç gönderisi yalnız daha önce yayımlanmış seçimleri değerlendirir. Bekleyen sonuç kayıp sayılmaz, koşan alan değişirse karşılaştırma dışı bırakılır. Resmî ikramiye olmadan kâr/ROI üretilmez. Kazanan kadar kaybeden seçim de sayılır.

## Doğrulanmış yayınlar

- Tanıtım: https://www.instagram.com/p/DfAc0Z4lKrM/
- Görselli kampanya: https://www.instagram.com/p/DfAe7jClD-7/
- Indianapolis ikinci altılı, 48 TL: https://www.instagram.com/p/DfAj6wHFDXf/
- Tanıtım Reels: https://www.instagram.com/reel/DfAkS2rkhJN/

Reels ve Story resmî API kaynağı: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-3a63181c-e5c6-4890-96dd-e4d425bef5e0
