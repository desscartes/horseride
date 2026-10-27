# Ganyan Zekası — Instagram pilotu

Durum: yerel taslak altyapısı hazır; hesap bağlı değil, otomatik yayın kapalı. Sunucu satın alınmaz. Eğitim evde kalır. İlk ay gelir beklentisi değil ilgi ve içerik kalitesi ölçülür. Takipçi sayısı kendi başına ücret oluşturmaz. Abonelik/hediye erişimi profesyonel pano ve Meta uygunluğuna bağlıdır; yarış/bahis içerikleri için ayrıca uygunluk kontrol edilir.

## Hesap sahibinin ilk adımları
1. Instagram'da ayrı marka hesabı aç. Kullanıcı adı ganyanzekasi müsait değilse ganyanzekasi.ai veya ganyan.zekasi denenebilir; müsaitlik kontrol edilmedi.
2. Görünen ad: Ganyan Zekası | Yarış Analizi.
3. Hesabı profesyonel İçerik Üreticisi hesabına dönüştür. Gerçek faaliyete uygun kategori seç; kategori politika muafiyeti sağlamaz.
4. İki faktörlü doğrulamayı aç, kurtarma kodlarını güvenli sakla. Şifre/token sohbete gönderilmez.
5. Biyografi: Veriye dayalı at yarışı analizi. Gerekçeli seçimler ve açık sonuç takibi. Uygulama geliştirme aşamasında. 18+ · Kazanç garantisi yok.
6. Şimdilik bozuk ngrok veya yerel IP bağlantısını biyografiye koyma.
7. Sohbete sadece kullanıcı adını ve profesyonel hesaba geçildiğini bildir.

## Sonraki teknik aşama
Instagram Login resmi API yolu profesyonel hesap destekler; Facebook Sayfası zorunlu değil. Meta uygulaması ve hesap yetkilendirmesi yapılacak. Yalnız gerekli basic/content_publish izinleri hedeflenir. İzin, token süresi, API sürümü ve hesap yetkisi gerçek hesapta doğrulanır. Medya API'nin erişebileceği HTTPS dosya adresinde bulunmalı; ev bilgisayarındaki dosya yolu yeterli değildir. Geçici erişim yerine yalnız yayın görsellerini barındıran küçük bir medya alanı seçilir. Hesap parolası otomasyona konmaz.

## Pilot yayın kuralları
Başlangıç: tanıtım, analiz yöntemi, dürüst sonuç takibi. Kupon taslağında sabit50TL üst bütçe, günde en çok1kupon hedefi. Bu operasyonel varsayılanlar performans üstünlüğü iddiası değildir. İlk starta en az30dk, program yaşı en çok15dk; yeterli kanıt yoksa paylaşım yerine bekleme. Kazanma yüzdesi kalibre edilmiş gibi yazılmaz. Gönderi görseli+metni+veri/model sürümü kaydedilir, çift yayın engellenir, çekilenler son anda doğrulanır, geç kalan taslak atılır. Bu son yayın kontrolleri henüz uygulanmadı; draft modülü yayın yapamaz.

Kaynak: https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login


## 27 Ekim — hesap bağlantısı doğrulandı
Instagram ganyan_zekasi profesyonel hesabı Facebook Ganyan Zekası Sayfasına bağlı. API SayfaID1361606213706671,InstagramID17841441483231653. Facebook Login for Business General/User token ve beş içerik izniyle kullanıcı doğrulaması başarılı. Token LOCALAPPDATA/HorseRide/Instagram/user-token.dpapi altında Windows CurrentUser DPAPI ve sınırlı ACL ile; sohbete/Git'e eklenmez. configure-instagram-local.ps1 standart Windows PowerShell Security modülünü tam yoldan başta yükler; WinForms callback ACL+DPAPI roundtrip örnek veriyle geçti. Token süresi/yenileme, resim için erişilebilir HTTPS adresi ve yayın/deduplication akışı hâlâ açık. publishEnabled false. İlk tanıtım kartı yerelde hazırlandı, yayımlanmadı.


## 27 Ekim — ilk API yayını başarılı
İlk tanıtım medyaID18065180756716709,permalink https://www.instagram.com/p/DfAc0Z4lKrM/ . API caption ve permalink doğrulandı. Görsel JPEG1080x1350, yalnız marka tanıtım resmi GitHubpublic/social altında sabit commitURL'den200image/jpeg doğrulandı. publish-instagram-introduction.ps1 ayrı Prepare/Publish/Verify modları, dosya kilidi, içerik hashine bağlı yayın günlüğü; belirsiz publish sonucunda kör POST tekrarı engellenir. Bu tek gönderi akışı; günlük kupon scheduler tamamlanmadı.
Token debug doğrulaması: doğru app/account/scopes, ilk token27Ekim19:00UTC/22:00TR bitecek. extend-instagram-token-local.ps1 App Secretı yalnız gizli yerel alanda alır; uzun tokenı doğrulamadan eskisini değiştirmez, App Secretı kalıcı saklamaz. Kullanıcı girişine ihtiyaç var.


## Uzun süreli yetkilendirme doğrulandı
27Ekim18:02UTC canlı debug_token ve hesap kimliği doğrulaması başarılı. Token bitiş26Aralık2026 17:44:41UTC/20:44:41Türkiye. Şifreli CurrentUser DPAPI kaydı; App Secret kalıcı saklanmadı. Token süresiz değildir; geçerlilik/izin değişimi ve iptal durumları günlük otomasyonda ayrıca kontrol edilmeli. İlk tanıtım gönderisi yayında; günlük kupon yayımlama henüz etkin değil.


## Otomatik şehir yayını — etkin
HorseRide-Instagram-Agent Windows görevi5dk aralıkla mevcut Windows kullanıcısının interaktif oturumunda çalışır. Codex/sohbet açık gerekmez; Windows kullanıcısı oturum açmış ve bilgisayar/internet çalışır olmalı. Günlük çalışma ücretli AI isteği yapmaz. config:data/instagram/agent-config.json; durum:data/instagram/agent-status.json. Durdurma: config.enabled=false veya Windows görevini devre dışı bırak.

Politika:50TL üst bütçe, şehir başına günde bir3kartlık carousel, günde en çok4şehir. İlk şehir koşusuna30–90dk kala; program15dk/kapsam raporu30dk içinde ve aynı program zaman damgası+at/jokey/kilo/start parmak izi. Yalnız doğrulanmış aktif model ve seçilen6ayağın servingReady durumu. Yeterli piyasa eşleşmesi yoksa sürpriz uydurulmaz. Gerçek kazanma olasılığı veya güvenilirlik üstünlüğü iddiası yok. Üçkart:kupon/ilkaday/sürpriz, finalveri tekrar kontrolü,sondakikadeğişimde yayın durur. Kayıtlıaynıpost yinelenmez;belirsizPOSTsonucunda yenidenpaylaşılmaz. Öncedenbilinmeyenuygunkoşu30dkpenceresinikaçırırsasonradanyayımlanmaz.

DinamikJPEG'ler ayrı data/instagram/media-repo klonundan yalnız instagram-media dalına gitpushile gider; çalışma ağacının main dalı değişmez. HTTPsha256ve içerik türü kontrolü;PSyayınAPI'si DPAPIsecretı yalnızişlemde çözer. Bu dosyalar kamuya açık marka/tahmin görselleridir; token ve veritabanı yayımlanmaz.

Sonuçlar:23:00TRsonrası veyaertesi gün yalnız sonuçları tamamlanan yayımlanmışseçimler için birgünlükrapor. Kupon/ilkaday/sürpriz ayrı sayılır;alan değişimiyapan kuponlar kıyasdışı;ikramiyedoğrulanmadanROI/kâr yok. Kayıtlar kaybedenleri de kapsar. Bekleyenresmîsonuçtamatamamlandıdenmez.

Tanıtım afişi imagegenile hazırlandı;normalorganikpost,ücretlireklamdeğil. MedyaID18133288342764719; https://www.instagram.com/p/DfAe7jClD-7/ APIcaption/permalink doğrulandı. İlkagentçalışması27Ekim18:20UTC program_stale nedeniylebilerekkuponyayımlamadı;73koşuda servingReady0. Otomasyonetkinolmasıveri ve başarının hazır olduğu anlamına gelmez.247test geçti;üçcarouselkartı sentetikQAile taşmakontrolünden geçti veörnekler yayımlanmadı.
