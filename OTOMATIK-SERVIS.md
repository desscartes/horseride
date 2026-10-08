# Otomatik servis ve günlük eğitim

Windows kullanıcı oturumu açıldığında Başlangıç klasöründeki Ganyan Zekasi.lnk, Baslat-GanyanZekasi.vbs üzerinden gizli servis gözetmenini çalıştırır. Oturum açılmadan önce çalışan bir Windows sistem servisi değildir. Bilgisayar kapalıyken veri toplanamaz.

API 8788 portunda çalışır. Mevcut servis varsa ikinci kopya başlatılmaz; gözetmenin kendi API süreci kapanırsa tekrar başlatılır. Kullanıcının elle açtığı mevcut API otomatik olarak kapatılmaz. Kod değişikliklerinin uygulanması için elle başlatılmış eski API bir kez kapatılmalıdır.

Günlük işlem İstanbul tarihine göre çalışır. Önceki günlerin kesinleşmiş sonuçları alınır; son üç gün eksik sonuçlar için tekrar kontrol edilir. Bilgisayarın kapalı kaldığı dönem için her turda en fazla yedi gün yakalanır. Eksik veya doğrulanamayan sonuçlar eğitimde uydurulmaz. Kısmi hatalar altı saat sonra tekrar denenir.

Türkiye ve ABD için mevcut özellikler ve parametrelerle ayrı CatBoost adayları eğitilir. Eğitim yereldir; bu işlem OpenAI çağrısı yapmaz. Diğer ülkelerin sonuçları arşivlenir ancak yeterli ülke modeli olmadan eğitilmiş sayılmaz.

Adaylar ayrı dosyalarda tutulur. Canlı modele geçiş için her iki modelin de eğitiminden sonraki en az 300 yarış ve 21 ayrı gün üzerinde karşılaştırma, en az iki yüzde puanlık ilk tercih artışı, günlere göre bootstrap aralığının pozitif alt sınırı, daha iyi Brier ve gerilemeyen ilk üç kapsaması gerekir. Python ve JavaScript tahminleri de eşleşmelidir. Bu koşullar sağlanmazsa aday yalnızca izleme modelidir; kuponları değiştirmez. Günlük yeniden eğitim doğruluk artışı garantisi değildir.

Durum: data/maintenance/state.json
Kayıt: data/maintenance/service.log
Modeller: data/daily-models
Elle başlatma: Baslat-GanyanZekasi.vbs
Elle günlük işlem: npm.cmd run maintenance

7 Ekim güncellemesi: API hazır olduğunda servis 20 dakikada bir başlamamış yarışların programını, mevcut model sırasını, yarış öncesi AGF kıyasını ve erişilebilen bölgesel hava tahminini `data/external/prestart` içine kaydeder. Her yarış için kendi ülke modelinin eğitim tarihi doğrulanır; bilinmeyen model ölçüme katılmaz. Bu işlem ücretli AI çağrısı yapmaz.

Günlük bakım, TJK toplantıları dışındaki ABD pistlerinin resmî Equibase takvimlerinden ek sonuçları `data/external/equibase-career` içine toplar. Tam kariyer veya bütün ülkelerde tam veri anlamına gelmez. Yeni arşiv mevcut modelin dondurulmuş girdilerini değiştirmez; yeni özellikler ayrı araştırma/eğitim denemelerinde kullanılmalıdır.

Gerçek ileri ölçüm: `data/maintenance/prospective-report.json`. Günlük sonuç toplandıktan sonra güncellenir. Elle yenileme: `node server/report-prospective.mjs`. Ülke/model bazında tüm yarışların ilk tercih isabeti, öneri filtresinin isabeti ve kapsamı, aynı yarışlarda yarış öncesi AGF kıyası ayrı tutulur. Sonuçları henüz gelmeyen yarışlarda oran null olarak kalır. Kapanış oranı bu kıyasa katılmaz. Rapor mevcut modeli izler; yeni adayın karşılaştırılabilmesi için onun tahminleri de gelecekteki yarışlardan önce dondurulup kaydedilmelidir.

Servis kurulumu öncesindeki iki dosyanın yedeği: `data/maintenance/backups/prestart-install-2026-10-07`. Windows eski PID kontrolünde EPERM döndürdüğünde, süreç yokluğu ek işletim sistemi sorgusuyla kontrol edilir; sorgu belirsizse kilit korunur.

API anahtarı ve .env dosyası telefona veya başlangıç kısayoluna kopyalanmaz. Telefonda verinin gelmesi için aynı ağdaki bilgisayarın açık olması gerekir.

8 Ekim bağlantı güncellemesi: APK 1.10 içinde **Sunucu bağlantısı** alanı vardır. Adres kaydedilmeden önce `/api/health` yanıtı doğrulanır. Evde güncel PC adresi `http://192.168.1.21:8788` olarak test edilebilir; modem adresi değiştirirse buradan güncellenir. API artık açıkça IPv4 dinler. Gözetmen kendi API'sini üç başarısız sağlık denetiminden sonra yeniden başlatır; `data/maintenance/service-health.json` sağlık durumunu ve telefon için yerel adresleri gösterir. Güncelleme çalışan eski süreç yeniden başlatılınca uygulanır.

Windows görev ve güvenlik duvarı kurulumu bir kez **Yönetici olarak açılan PowerShell** içinde yapılır:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Game_Project\HorseRide\server\setup-local-service.ps1"
```

Kurulum yalnızca yerel alt ağdan TCP 8788 erişimi açar. Kullanıcı oturumu açılınca ve her gün 06:00'da servis başlatma görevi kaydeder; görev başarısızlıkta tekrar denenir. Kullanıcı oturumu açılmadan çalışma ya da bilgisayar kapalıyken çalışma sağlamaz. Aynı servis zaten açıksa ikinci gözetmen başlatılmaz. Kurulum yönetici yetkisi gerektirir; E_ACCESSDENIED alınmışsa görev ve ağ kuralının kurulduğunu varsaymayın.

Codex sohbetinde ayrıca her gün 10:00 için veri/model kontrolü otomasyonu kurulmuştur. Bu ajan kontrolü, uygulamanın veri/eğitim gözetmeninden ayrıdır; Codex ve PC erişilebilirken çalışır. Başarısı doğrulanmamış aday canlıya geçirilmez. Sunucuya taşıma adımları `docs/server-migration.md` içindedir.
