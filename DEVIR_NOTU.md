# Ganyan Zekası — devralma notu

Hazırlanma: 16 Ekim 2026, Europe/Istanbul. Bu belge parola, özel/açık erişim anahtarı veya API anahtarı içermez.

## 1. Yeni sohbetin önce bilmesi gerekenler

- Kullanıcı bu projeye projenin bulunduğu bilgisayardaki yeni Codex sohbetinden devam edecek. Önce hangi kopyada çalışıldığını doğrula; aşağıdaki geliştirme ve canlı sunucu yollarını birbirine karıştırma.
- Hedef: Türkiye ve yurt dışı at yarışlarında yarış öncesi tahmin başarısını ölçülebilir biçimde artırmak; tüm günlük programlara hızlı, tutarlı ve veriye dayanan Türkçe yorum sağlamak; ücretli API tüketimini önlemek.
- Kullanıcı daha önce gece boyunca özerk ilerlemeyi, rutin işler için tekrar tekrar onay sorulmamasını istedi. Gerçek erişim veya gerekli bilgi engelini açıkça bildir; güvenlik izinlerini atlatma.
- Yeni verinin faydalı olacağı varsayılmamalı. Aday model aynı tarihli testte mevcut modelle karşılaştırılmalı; başarı artışı doğrulanmadan aktif modele geçirilmemeli.
- Bu notun yazıldığı 16 Ekim kontrolünde SSH bağlantısı sunucuya ulaştı ancak `Permission denied (publickey,password,keyboard-interactive)` döndü. Dolayısıyla aşağıdaki süreç durumları **15 Ekim son doğrulamalarıdır; güncel tamamlanma durumu değildir**.
- Çalışma ağacında çok sayıda değişmiş ve izlenmeyen dosya var. Reset/clean yapma, topluca geri alma, kullanıcı değişikliklerini silme. Bu çalışmada commit veya push yapılmadı. Yeni alt ajan kullanma; kullanıcı ayrıca istemedi.

## 2. Bilgisayarlar, proje yolları ve bağlantı

### Geliştirme kopyası

- Yol: `D:\Game_Project\HorseRide`
- Bu notun kaydedildiği yer: `D:\Game_Project\HorseRide\DEVIR_NOTU.md`
- Geliştirme kopyasında `data/maintenance/remote-server.json` işareti bulunabilir; yerel servis gözetmeninin ikinci kez çalışmasını engeller. Bu işareti canlı sunucuya kopyalama.
- Git deposu: `https://github.com/desscartes/horseride.git`. Git deposu tek başına veritabanını, model ağırlıklarını ve yerel son değişikliklerin tamamını taşımıyor.

### Canlı sunucu

- Windows bilgisayar adı: `Djengo`.
- Proje: `D:\Apps\HorseRide`
- LAN IPv4: `192.168.1.15`
- Tailscale IPv4: `100.80.77.78`
- SSH kullanıcısı: `desscartes`, port `22`.
- Bağlantı biçimi: `ssh desscartes@192.168.1.15`. Yetkili kimlik doğrulama ayrı kurulmalı; kimlik bilgileri bu belgede yok.
- Aynı sunucu bilgisayarda Codex açılıyorsa SSH gerekmez; doğrudan `D:\Apps\HorseRide` klasöründe çalış.
- Node: `D:\Tools\node-v24.15.0-win-x64\node.exe`
- Python: `D:\Apps\HorseRide\.venv\Scripts\python.exe`
- Ollama: `D:\Tools\Ollama\ollama.exe`
- Ollama modelleri: `D:\Models\HorseRide`
- Donanım: i5-8300H, 16 GB RAM, GTX 1050 4 GB; Windows 11 Pro.

### Servisler ve dış adres

- Uygulama: `https://ganyan-zekasi.tailab9792.ts.net/`
- API: `http://127.0.0.1:8788` / LAN'da `http://192.168.1.15:8788`.
- Kısıtlı dış erişim servisi: `127.0.0.1:8790`, Tailscale Funnel üzerinden yayımlanıyor.
- Ollama: yalnızca `127.0.0.1:11434`; internete açma.
- `GanyanZekasi-Service` ve `GanyanZekasi-PublicGateway` görevleri SYSTEM hesabıyla otomatik başlıyor. Tailscale yayını kalıcı.
- 15 Ekim yeniden başlatması sonrası API, dış adres ve Ollama otomatik açılışı doğrulandı. Ollama'nın GPU keşfi yaklaşık 1–2 dakika sürdü; CUDA keşif hatasından sonra GTX 1050 Vulkan ile bulundu ve model listeleme 200 döndü.
- SSH sorunu geçmişi: eski geliştirme PC'sinin IP'si `.21` iken `.18` oldu. SSH erişim kısıtı ve güvenlik duvarı buna bağlıydı. Servis çalışsa bile IP kısıtı anahtarı reddedebilir. Windows'taki `administrators_authorized_keys` ve `HorseRide-SSH-DevPC` kuralı kaynak IP'ye bağlıdır. Yeni PC için gerekirse dar kapsamlı yetki düzelt; tüm ağı gereksiz açma.

## 3. Hangi model ne yapıyor?

### Sayısal tahmin

- Yerel CatBoost tabanlı sıralama modelleri atları aynı koşu içinde karşılaştırıyor. Ülke/ırk ayrımlı aday deneyler mevcut.
- Bazı ülkelerde geçerli etkin model yoksa program puanlaması karşılaştırıcı olarak kullanılıyor; bunu eğitilmiş model başarısı diye sunma.
- Eğitim tarih sırasına göre ayrılıyor; aynı günün veya geleceğin sonuçları geçmiş özelliklerine girmemeli.
- Yeni modelin canlı ve eğitim özellikleri birebir uyuşmalı. Python/Node skor eşitliği ve bütün özellik vektörü eşitliği doğrulanmadan yayımlama.

### Yorum üretimi

- Etkin sağlayıcı son doğrulamada: `HORSERIDE_ANALYSIS_PROVIDER=local`.
- Model: `qwen3:4b-instruct`, yaklaşık 4B parametre, Q4_K_M, yaklaşık 2,5 GB dosya, Ollama 0.40.4.
- Qwen hazır modeldir; at yarışı verileriyle ağırlık ince ayarı yapılmadı. Veriler bağlam olarak veriliyor. Eğitilen sayısal CatBoost ile Qwen'i karıştırma.
- Yerel yorum akışı kısa yapılandırılmış seçimleri doğrulanmış Türkçe cümlelere dönüştürüyor. Son yorumların bir bölümü doğrudan kayıtlı verilerden deterministik hazırlanıyor; her cümle serbest LLM üretimi değil.
- Düşünme kapalı, kısa çıktı, tek paralel üretim ve kalıcı yorum önbelleği kullanılıyor. Yerel hata ücretli OpenAI'ye otomatik geçmiyor.
- Kodda eski OpenAI Responses yolu ve `OPENAI_MODEL=gpt-6-luna` ayarı duruyor; yerel sağlayıcı seçiliyken bu dal çalışmıyor. Eğitim/puanlama/kupon hesapları OpenAI kullanmıyor. Codex sohbet kullanımı uygulama API tüketiminden ayrıdır.
- Ücretli kullanım sayacı: `data/maintenance/analysis-usage.sqlite`; yerel kullanım da token işleyebilir fakat OpenAI faturası oluşturmaz.

## 4. Başarı hakkında dürüst durum

- Bütün yarışlarda %50 üstü birincilik tahmin başarısı doğrulanmış değil.
- İlk tercih başarısı, kazananın ilk üç öneride bulunması, seçilen atın ilk üç bitirmesi ve kuponun tam tutması farklı ölçümlerdir; birbirinin yerine kullanma.
- Son tamamlanmış eski zenginleştirme araması: `data/intelligence-models/2026-10-15/enriched-1792064902066`.
- Önceki ölçümlerde TR adayı 177 testte %28,81 / mevcut %31,64; ABD 235 testte %28,51 / mevcut %30,21 idi. GB/FR/ZA'da bazı adaylar yükseldi, ancak örnek ve bağımsız ileri test şartları tamamlanmadı. Bunlar yeni maiden/ikramiye deneyinin sonuçları değildir.
- Terfi yaklaşımı: en az 300 test yarışı ve 21 gün, iki modelin eğitim tarihinden sonraki ortak test, en az 2 yüzde puan artış, eşleştirilmiş gün bazlı bootstrap %95 alt sınır > 0, Brier iyileşmesi ve ilk üç ölçümünde gerileme olmaması. Tek bir eski test üzerinde çok deneme yapmak ileriye dönük başarı kanıtı değildir.
- Yeni deneylerin tamamlandığı veya başarıyı artırdığı henüz doğrulanmadı. Aktif tahmin modelinin değiştiği iddia edilmedi.

## 5. Yayımlanmış uygulama ve önemli önceki düzeltmeler

- Son APK: **1.31**, versionCode **32**.
- İndirme: `https://ganyan-zekasi.tailab9792.ts.net/downloads/GanyanZekasi-1.31.apk?v=20261015-evidence`
- Yerel APK: `outputs/GanyanZekasi-1.31.apk`.
- APK SHA256: `01CE33BF4E38F2402C4CB5ED62AA07C34ED83B1AB622B707A1C76F6CA665CEDE`.
- Sunucu dağıtım paketi: `outputs/GanyanZekasi-server-1.31.zip`. Bu paket sonraki maiden/eğitim değişikliklerini içermiyor; son kaynak yerine körlemesine yeniden dağıtma.
- 1.31, 15 Ekim sunucuda dosya özetleri doğrulanıp mevcut dosyalar yedeklenerek yayımlandı. Sonraki eğitim ve yorum değişiklikleri ayrıca dağıtıldı; yerel/sunucu kaynak eşitliğini yeniden kontrol et.
- At geçmişi hızlı program yenilemesinde null ile silinebiliyordu; kayıtlı resmî profilden yeniden doldurma ve `hydratePublishedProfiles` eklendi.
- `findHorseProfileTables` tüm sürümleri `.all()` ile yüklemek yerine `.iterate()` ile ilk geçerli kesin kimlik eşleşmesinde dönüyor. SQLite profil sorgusu indeksi eklendi ve sunucuda oluşturuldu.
- `commentary-evidence.mjs`: tarih filtresi, son dereceler, pist/mesafe kayıtları, kilo/jokey/sınıf karşılaştırması, destekli sürpriz gerekçesi.
- `refresh-surprise-evidence.mjs`: AGF/geçmiş kanıtı değişince yorumları ücretli LLM çağrısı olmadan yeniliyor; tekrarlayan yenilemeler idempotent.
- Sürpriz için AGF ilk iki (eşitlikler dahil), yorum ilk iki ve koşmayan atlar dışlanıyor. Kanıt yokken zorunlu sürpriz uydurulmuyor. İzmir 1'de ROLYANA canlı doğrulandı.
- `served-program.mjs` geçerli resmî bahis başlangıçlarını ve sürpriz sinyalini geçici veri boşluklarında koruyor.
- Resmî 5'li/6'lı başlangıçları zorunlu; rastgele ardışık koşulardan kupon oluşturma. Aynı şehirde birden fazla resmî 5'li/6'lı olabilir.
- Seçili hipodrom için 50/100 TL sabit kupon, genel günlük 5'li/6'lı önerisi ve bütçe mantığı korunmalı. Çekilen at veya resmî başlangıç değişince eski kuponun geçersizliği ele alınıyor; sonradan yarış öncesi tahminmiş gibi yazılmıyor.
- Sosyal kuponlar açık web kaynaklarından; paylaşım sayısı gerçek oynanma sayısı değil. X listesi için API erişimi yok; otomatik X toplama kapalı. Tarayıcı çerezleri sunucuya taşınmadı.
- Raporlama için yarış öncesi tahminleri saklama, yerli/yabancı/şehir ayrımı, tam tutma ve kısmi kupon başarıları, sürpriz ve doğrulanmış ödeme bilgisi hedefleri korunmalı; rapor başlangıcı kullanıcının isteğiyle 10.10.2026.

## 6. Son eklenen kaynaklar ve özellikler

### Maiden ve idman

- `server/race-class.mjs`: Maiden/Satış ve Maiden Class etiketlerinde maiden niteliği öncelikli korunuyor.
- `server/maiden-evidence.mjs`: kayıtlı maiden startları, ikincilikler, ilk üç kayıtları, son üç yarışta iyileşme, geçmiş galibiyet varsa uygunluk/eşleştirme uyarısı.
- Son 30 gün idmanı ve aynı pist/hipodromda yeterli 400 m kaydı varsa süre karşılaştırması yorumda kullanılıyor. Gelecek/aynı gün kayıtları dışlanıyor. Çalışma şiddeti/zemin doğrulanmadan otomatik form artışı sonucu çıkarılmıyor.
- “Bu at artık kazanmak zorunda” çıkarımı yok; kayıt eksikliği de olumsuz performans diye yorumlanmıyor.
- Maiden/idman açıklaması sunucuya dağıtıldı, kayıtlı yorumlar bakım göreviyle yenilendi. İzmir dış yanıtında en az bir maiden koşusunda yeni metin doğrulandı. Bütün koşuların/istemci önbelleklerinin son metni aldığı kesinleştirilmedi.

### İkramiye

- `server/race-prizes.mjs`: TJK CSV'den sıralara göre resmî ikramiye, kaynak para birimi korunarak okunuyor; yetiştirici primiyle karıştırılmamalı.
- `server/index.mjs` içindeki yeni CSV ikramiye alanı yerelde eklendi; bu son parser değişikliğinin canlı index'e dağıtımı bu aşamada doğrulanmadı. Sonraki canlı maiden yorumu yalnız ayrı modüllerle dağıtıldı.
- `server/collect-archived-prizes.mjs`: arşivdeki resmî program CSV'lerinden ayrı kayıt üretir: `data/external/race-prizes/records.json`.
- 4.723 kaynak sürümünden son programlar seçildi: 113 tarih/şehir programında 916 koşu ikramiyesi çıkarıldı.
- Eğitim sınırı 14 Ekim olduğunda 841 kayıt uygundu, 758'i geçmiş yarışla tam tarih/şehir/koşu eşleşti; 83'ü eşleşmedi. 75 kayıt tarih sınırının dışındaydı; eksik diye sayma.
- Eşleşenler arasında TR 208, ABD 293, GB 64, FR 64, ZA 67; diğer ülkeler de var fakat mevcut beş ülke eğitimine hepsi girmiyor. Bu sayılar tüm tarihsel arşivin eksiksiz ödül kapsamı değildir.
- `server/maiden-training.mjs`: 10 yeni gözlenen maiden/ikramiye özelliği. Eksik tutarı uydurmaz; önceki koşu ödülüyle oran yalnız aynı para biriminde hesaplanır.
- `training-archive.mjs` isteğe bağlı `RACE_PRIZE_REGISTRY_PATH` ile kayıtları birleştirir. Eğitim yöneticisi dosyayı deney klasörüne sabitleyerek sonradan değişmesini engeller.
- Atın toplam kazancı, satın alma fiyatı, satış/claiming bedeli, yarış ikramiyesi ve tahmini piyasa değeri farklıdır. Birbirinin yerine koyma. Doğrulanmış satın alma fiyatları henüz eğitime katılmadı.

### Model sürüm uyumu

- Yeni intelligence özellikleri eski modellerde pedigree alanlarının indeksini kaydırabiliyordu. `intelligenceSchemaVersion=2` ve `legacy` ayrımı eklendi.
- Yeni eğitim raporu sürümü yazar; `ranking.mjs` ve `verify-intelligence.mjs` eski raporlarda eski özellik düzenini korur. Sonraki kaynak değişikliklerinde bu uyumu test et.
- Eğitim karşılaştırmasına `without_maiden_prize` adayı eklendi: yeni özellikler zorla kullanılmıyor; seçim doğrulama döneminde yapılıyor, test dönemiyle parametre seçilmiyor.
- `maidenPrizeCoverage` eğitim/validasyon/testte kapsamı raporlar. Son düzeltmede train bölümü parametre seçiminin gerçek `train` dizisine çevrildi; validasyonla üst üste sayılmıyor.

## 7. Devam eden işler: önce durumlarını kontrol et

16 Ekim yeniden kontrolü SSH kimlik doğrulaması nedeniyle yapılamadı. Aşağıdakiler 15 Ekim son gözlemidir; işi tekrar başlatmadan görev, PID, log ve durum dosyalarını kontrol et.

### Deney 1

- Görev: `GanyanZekasi-MaidenPrize-20261015`
- Klasör: `data/intelligence-models/2026-10-15/maiden-prize-v1`
- Durum: `training-state.json`
- Log: `data/maintenance/maiden-prize-training-20261015.log`
- 15 Ekim 17:43 UTC başladı, veri sınırı `2026-10-14`. Son gözlemde hâlâ `exporting`.
- TR kontrol girdisi: 646 gün / 10.922 kabul edilmiş koşu tamamlandı. Ardından genişletilmiş TR girdisi yeniden hazırlanıyordu; son doğrulanan ilerleme 300 gün / 5.299 koşu. Tüm ülke eğitimleri bitti diye yorumlama.
- Ülkeler: TR, US, GB, FR, ZA; ayrıca TR Arap ve İngiliz alt grupları.
- Çalıştırıcı: `server/run-intelligence-training.mjs`; eğitim: `server/train-intelligence.py`; eşitlik kontrolü: `server/verify-intelligence.mjs`.

### Deney 2

- Görev: `GanyanZekasi-MaidenPrizeV2-20261015`
- Bekleyen betik: `.migration/run-prize-successor.ps1`
- Klasör: `data/intelligence-models/2026-10-15/maiden-prize-v2`
- Log: `data/maintenance/maiden-prize-v2-training.log`
- İlk görev Running durumundan çıkınca ikramiye kayıt yoluyla ikinci deneyi başlatır. Bekleme üst sınırı 8 saattir. İlk deney başarısız olsa da ikinciye geçebilir; iki logu ayrı kontrol et. Son gözlemde ikinci eğitim dosyası henüz oluşmamıştı.
- Tarih sınırı deney başlarken yerel güne göre hesaplanıyor. İkinci deney 16 Ekim başlarsa sınır 15 Ekim olabilir; eşit test karşılaştırmasında bunu açıkça dikkate al.

### Eksik resmî sonuçları yeniden toplama

- Görev: `GanyanZekasi-PrizeHistoryRepair-20261015`
- Betik: `server/repair-prize-history.mjs`
- Durum: `data/maintenance/prize-history-repair.json`
- Log: `data/maintenance/prize-history-repair.log`
- 83 eşleşmeyen kayıttan 9 tarih/yerli-yabancı kapsam grubu türetildi. Son kontrolde 5 grup işlenmiş, görev düzeyinde hata yoktu; 54 koşu hâlâ reddedilmişti.
- `saved` sayısı yeniden kaydedilen mevcut yarışları da içerir; hepsini yeni eklenen yarış sayma. İptal/eksik sonuçlar normal şekilde dışarıda kalmalı.
- Sonunda `server/audit-prize-coverage.mjs` tekrar çalıştırılıp 758/83 sayıları yenilenmeli. Yeni toplanan veri ilk deneyin sabitlenmiş girdisini değiştirmez; sonraki deneyde kullanılabilir.

### Yabancı soy toplama — başlangıcı doğrulanmalı

- `server/collect-tjk-pedigree.mjs` varsayılan TR davranışını koruyarak `PEDIGREE_COUNTRIES` ülke filtresiyle genişletildi.
- Yabancılarda da yalnız resmî at kimliği ve anne/baba eşleşmesi doğrulanırsa kayıt kabul edilir; kimliği olmayan atlar isim benzerliğiyle birleştirilmez.
- `GanyanZekasi-ForeignPedigree-20261015` adlı görev için US,GB,FR,ZA ve azami 80 kayıtla başlatma komutu gönderildi. Araç sonucu konuşma geçişinde alınamadı; **görevin gerçekten oluştuğu/çalıştığı doğrulanmadı**.
- Log beklenen yeri: `data/maintenance/foreign-pedigree-batch.log`.
- Kayıt ve rapor: `data/external/tjk-pedigree/registry.json`, `collection-report.json`, `retries.json`. Kaynak genel hata verirse toplayıcı erken keser, yeniden deneme süreleri var.
- Eski `GanyanZekasi-ArchiveExpansion-20261015` gibi veri işleri de bulunuyor. Aynı toplama/eğitim işini kopya başlatmadan tüm görevleri kontrol et.

## 8. Toplu veri kontrolünde çıkan temel eksikler

`server/audit-frozen-inputs.mjs` ilk deneyin sabit arşiv alanlarını kontrol etti. Bu kontrol son birleşmiş eğitim vektörü kapsamının yerine geçmez.

- Baba ve anne alanları beş ülkenin incelenen satırlarında doluydu; dolu olması kimlik doğruluğu veya model katkısı kanıtı değildir.
- Anne-baba hattı: TR 106.801 at/koşu satırında 6.206 (~%5,8); ABD 62.290 satırda 5.679 (~%9,1); FR 15.603 satırda 28; GB ve ZA'da sıfır. Bunlar benzersiz at sayıları değil.
- Resmî at kimliği FR arşivinde yoktu, ZA'da çok azdı. İsimden otomatik soy/satış eşleştirmesi güvenli değil.
- İlk sabit arşivde doğrudan yarış ikramiyesi alanı yoktu; ikinci deneyde ayrı kayıt dosyasıyla birleştirme gerekli.
- Üst düzey hava alanı sayımı sıfır çıktı; bu tüm hava verilerinin yok olduğu anlamına gelmez. At kaynak alanları, ayrı `archivedPrestartWeather` ve sonradan gözlenen koşullar ayrı kontrol edilmeli. Audit betiğindeki son düzeltme üst seviye sayımı `withArchivedEnvironment` olarak adlandırıyor ve at kaynak alanlarına da bakıyor; bu sürümün yeniden çalıştırılması gerekiyor.
- ABD'de 3.834 koşuda sonradan gözlenen çevre kaydı vardı. Yarış sonrası gözlemi hedef koşu için önceden bilinen veri gibi kullanma.
- Gerçek yarış öncesi hava tahmini kaydı geçmişte 136 koşuya eklenmişti; mevcut sayıyı yeniden kontrol et. Toplanan bu alanın tüm sayısal modellerde kullanıldığı henüz doğrulanmadı.
- Yabancı yarışlarda idman, ara dereceler/tempo, geçmiş rakip alanları ve bütün kariyer kapsamı eşit değil. Kaynak kapsamı TJK'nin yayımladığı yabancı toplantılarla sınırlı olabilir.
- Satış fiyatı hâlâ eşleşmiş eğitim verisi değil. TİGEM ve Keeneland resmî kaynakları belirlendi; RNA/satılmadı durumları satış fiyatı değildir.

## 9. Başarıyı artırmak için sıralı aksiyon planı

1. **Mevcut işleri sonuçlandır:** İki deneyin ve veri toplamanın görev/rapor/loglarını kontrol et; durmuş, hata almış veya doğrulamada kalmış işi sebebiyle düzelt. Yinelenen süreç başlatma.
2. **Veri kapsamını say:** Ülke ve zaman dönemi bazında idman, geçmiş yarış, aynı pist/mesafe, sınıf, anne-baba hattı, resmî kimlik, ikramiye ve yarış öncesi hava eksiklerini tek değerlendirmede çıkar. Boşluğu sıfır performans gibi değerlendirme.
3. **Eksik resmî sonuçları tamamla:** 83 uyuşmazlığı yeniden ölç; iptal, koşmayan at, eksik bitiriş veya isim/şehir takma adı ayrımını yap. Resmî kimlik olmadan agresif birleştirme yapma.
4. **Maiden modelini sınama:** Önceki maiden denemeleri, ikincilik/ilk üç, yakın dönem gelişimi, ilk kez koşma ve eksik kariyer ayrımı; mesafe/pist değişimi, jokey/kilo ve idman kanıtı. Maiden ikinciliği otomatik kazanma zorunluluğu değildir. TR ve yabancı maiden/maiden claiming ayrı bağlamları koru.
5. **İkramiye ve ekonomik sınıf:** Birinci/ikinci/üçüncü ödüllerini ve kaynağını sakla; toplam purse ile birincilik ödülünü ayır. Aynı ülke/para birimi ve dönem içinde önceki yarışlara göre seviyeyi karşılaştır; kur/enflasyon kaynaklı sahte üstünlüğü önle. Claiming bedelini gerçek satın alma bedeli sanma.
6. **Gerçek satış kayıtları:** TİGEM, Keeneland ve gerekirse diğer resmî satış arşivleri. Lot, satış tarihi, satıldı/RNA durumu, tutar/para birimi, anne/baba, doğum yılı/cinsiyet ve kaynak kaydıyla eşleştir. Yarış tarihinden sonraki satışı geçmiş tahmine sokma. Bilinmeyen piyasa değerini uydurma. Kapsam ve katkı ölçülmeden özelliği aktif etme.
7. **Soy kapsamını genişlet:** Özellikle damsire eksikleri; yabancı atlarda kimlik doğrulama. Pist, mesafe, kuru/ıslak zemin ve yeterli örnekle kan hattı istatistiği; az örneklerde yumuşatma ve belirsizlik. Aynı atın kendi sonucuyla soy puanını şişirme.
8. **Hava ve zemin entegrasyonu:** Hipodrom koordinatı, koşu saati/zaman dilimi, yarıştan önceki tahmin alınma zamanı ve resmî zemin durumunu eşleştir. Yağmur tek başına ıslak pist değildir. Geçmiş sonuçtan sonra açıklanan hava/zemini hedef gün girdisine kaçırma; geçmiş atların deneyimi için ayrı kullanım mümkün.
9. **ABD/yabancı derinliği:** Resmî geçmiş yarışlar, speed figure/karşılaştırılabilir süre, ara dereceler/tempo, trouble notları, kapı/pist eğilimi, yarış klasmanı ve rakip kalitesi; idman mesafesi/süre/birim/grup sırası. Erişim ve kullanım koşulları doğrulanmadan ücretli API veya yetkisiz toplama kurma.
10. **Dürüst karşılaştırma:** Aynı bağımsız tarihlerde mevcut model ve aday; ülke, şehir, ırk, maiden/diğer sınıf ve veri yeterliliği kırılımları. İlk tercih, kazanan ilk üç öneride, kalibrasyon/Brier/log loss, kapsam ve belirsizlik. Yeni özellikli/özelliksiz karşılaştırma. Küçük örnekle %50 iddiası yok.
11. **İleriye dönük kayıt:** Yarış öncesi zaman damgalı sabit tahminler; arşiv testinden ayrı gerçek kullanım başarısı. Sonradan yeni sürprizi eski tahminmiş gibi kaydetme. Model sürümü değişince raporu karıştırma.
12. **Hız ve token:** Günlük programları kullanıcı açmadan önceden yorumla; sadece değişen/geçersiz koşuyu yeniden üret. Tek iş ve kalıcı ortak önbellek; ücretli fallback kapalı. Hataları kaynak/kod/süre/istek kimliğiyle logla. Eski istemci önbelleklerinin yeni kanıt metinlerini göstermesini ve bazı koşuların eksik görünmesini test et.
13. **Yerel LLM seçimi:** 4B ile 8B'yi aynı yarışlarda Türkçe kalite, doğruluk, süre, RAM/VRAM üzerinden dene. 14B mevcut donanımda öncelikli değil. Daha büyük yorum modeli sayısal tahmin başarısının otomatik artışı değildir. Donanım almadan önce kontrollü ölçüm yap.
14. **Uygulama doğrulaması:** Resmî 5'li/6'lı başlangıçları, bütçe ve çekilen atlar; yerli/yabancı/şehir raporu; tam tutma, 5/6 gibi kısmi başarı, sürpriz ve resmî ödeme. Sosyal kuponun kaynak sayısını gerçek oynanma sayısı diye gösterme. Sade metin, gizli model adları ve gecikme/hata durumlarını kullanıcı açısından kontrol et.

## 10. Testler ve operasyon notları

Son çalıştırmalarda geçen gruplar:

- Maiden/idman + commentary + sınıf: 10 test.
- Yerel analiz + ikramiye + maiden ekonomik özellikler: 11 test; yerel hata halinde dış API çağrılmaması dahil.
- Sıralama + tarihsel revision + sınıf + ekonomik eksik değerler: 11 test.
- Soy kaydı ve pedigree: 5 test; resmî kimlik/anne-baba doğrulaması, gelecek/same-day dışlama ve ülke/pist ayrımı.
- Önceki profile-hydration, profile lookup, sürpriz yenileme, kupon ve önbellek testleri geçti. Son değişikliklerden sonra ihtiyaç oldukça ilgili grupları tekrar çalıştır; tüm testlerin son tek seferde birlikte koştuğunu iddia etme.
- Son Python eğitim betiği `ast.parse` ile sözdizimi kontrolünden geçti. İki yeni eğitimin runtime parity doğrulaması henüz tamamlanmış kabul edilmemeli.

Sunucu bilgisayarda başlangıç kontrolü:

```powershell
Set-Location D:\Apps\HorseRide
Get-ScheduledTask -TaskName 'GanyanZekasi*' | Select-Object TaskName,State
Get-Content data/maintenance/service-health.json -Raw -Encoding UTF8
Invoke-RestMethod http://127.0.0.1:8788/api/health
Invoke-RestMethod http://127.0.0.1:11434/api/tags
Get-Content data/intelligence-models/2026-10-15/maiden-prize-v1/training-state.json -Raw -Encoding UTF8
Get-Content data/maintenance/maiden-prize-training-20261015.log -Tail 15 -Encoding UTF8
```

- ScheduledTask State 4=Running, 3=Ready. Ready başarılı bitti anlamına gelmez; `Get-ScheduledTaskInfo` ve log/durum dosyasına da bak.
- `data/maintenance/service.log` ve `service-health.json` ana servis kanıtları; analiz logları `data/maintenance/analysis-logs/` altında.
- Güvenli API yenilemesi: UTF-8 BOM'suz `data/maintenance/reload-api.json` içine yeni ISO `requestedAt` yazılır; gözetmen aktif analizler bitince yeniden yükler. Dış erişimde hazır yorumları ayrıca doğrula.
- Kayıtlı yorum bakımının API bellek önbelleğine yansıması yeniden yükleme gerektirebilir. Son bakım görevinden **sonra** yenile; işlem sürerken eski belleğin tekrar yüklenmesini önle.
- SSH oturumundan doğrudan başlatılan uzun işler oturum kapanınca düşebilir. Kalıcı işler Windows ScheduledTask SYSTEM ile, çalışma dizini belirtilerek çalıştırılıyor.
- Uzak `Get-CimInstance`/WMI geçmişte takıldı; mecbur değilsen kullanma. Node inline `-e` komutlarında Windows SSH tırnakları kaybolabiliyor; dosya veya PowerShell EncodedCommand tercih et.
- Windows PowerShell eski varsayılan kodlaması Türkçe dosya çıktısını bozabiliyor; `Get-Content -Encoding UTF8` kullan.
- Canlı veri dizinini veya `.env` dosyasını kaynak dağıtımıyla ezme. Çalışan SQLite'ı yalnız ana dosyayı kopyalayarak yedekleme; çevrimiçi backup API veya düzgün durdurma/yedekleme yöntemi kullan.
- APK yeniden üretilecekse aynı uygulama imzası korunmalı; varsayılan başka debug imzasıyla kullanıcıya yükseltme verme. İmza anahtarı bilgileri özellikle bu nota alınmadı.

## 11. Yeni Codex sohbetine kısa başlangıç isteği

“DEVIR_NOTU.md dosyasını oku. Önce doğru geliştirme/canlı klasöründe olduğumuzu ve mevcut eğitim/veri görevlerini doğrula. Biten deneylerin raporlarını ve runtime parity sonucunu incele; tamamlanmayan işlerde sebebi düzelt. Eksik veri kapsamını ülke bazında ölç, doğrulanmış kaynaklarla tamamla. Yeni verilerin başarı katkısını ortak bağımsız testte ölç; artış yoksa aktif modeli değiştirme. Parola/anahtarları paylaşma, mevcut veriyi veya kullanıcı değişikliklerini silme.”

Aktarım güncellemesi — 16 Ekim: Kullanıcı sunucunun SSH kaynak IP kısıtına geliştirme bilgisayarının `.21` adresini de ekledi. Ardından bu belge `Djengo` üzerindeki `D:\Apps\HorseRide\DEVIR_NOTU.md` yoluna başarıyla aktarıldı. Bu yalnızca belgenin aktarımıdır; yukarıdaki eğitimlerin 16 Ekim güncel durumunun doğrulandığı anlamına gelmez. Yeni sohbet bu canlı klasörde belgeyi okuyarak başlamalı ve iki kaynak kopyası arasındaki son farkları kontrol etmelidir.

## 16 Ekim 2026 — bu PC'de devralma kontrolü
- Canlı klasör D:\Apps\HorseRide doğrudan okundu; Git deposu bu dağıtım klasöründe bulunmuyor.
- maiden-prize-v1 complete; 7 artifact için verification.json delta=0, activeModelChanged=false.
- İlk tercih aday/mevcut: TR 29.94/32.20 (177), US 29.79/31.06 (235), GB 20.74/16.13 (217), FR 17.53/14.95 (194), ZA 33.33/25.25 (198), TR-arabian 33.72/32.56 (86), TR-thoroughbred 37.36/31.87 (91). GB/FR/ZA karşılaştırıcısı program baseline; eğitilmiş aktif model diye sunulmaz. Hiçbiri terfi edilmedi.
- v1 ikramiye özellikleri boş; bu deney ikramiye katkısı kanıtı değildir.
- audit-prize-coverage tekrar çalıştı: through=2026-10-15, toplam/uygun 916, eşleşen 830, eşleşmeyen 86. Eski 2026-10-14 sınırında eşleşmeyen 81; eski nottaki 83 ile yalnız aynı tarih sınırında karşılaştır.
- Yabancı soy toplayıcısı tamamlanmış ancak attempted=0, saved=0; kapsam artışı yok.
- Windows ScheduledTask/CIM ve schtasks sorguları erişim hatası verdi. Görev durumları doğrulanmış sayılmıyor.
- V2 durum/log dosyası yoktu. Önceki bekleme betiğinin 8 saatlik süresi geçmişti. Yeni .migration/resume-prize-v2-local.ps1, exclusive lock ve mevcut state kontrolüyle yerel olarak başlatıldı.
- V2 startedAt=2026-10-16T08:04:17.188Z (11:04 İstanbul), through=2026-10-15. İkramiye snapshot oluştu; archive-days sayısı 46'dan 182'ye ilerledi; son phase=exporting, errors=[]. Henüz eğitim/başarı sonucu yok.
- Çalışma açık komut oturumunda (71984); SYSTEM kalıcı görev kurulmadı. Oturum veya uygulama kapanırsa süreklilik garanti değil; yeniden başlatmadan state/log ve süreçleri kontrol et.
- API service-health.json son kontrolde apiHealthy=true; doğrudan HTTP sağlık testi bu kontrolde yapılmadı.

# 16 Ekim — Avustralya ilk uygulama
- Tespit: AU eğitim çalıştırıcısına dahil değildi; uygulama genel program puanı ile sıralıyordu. Eksik form/derece alanları nötr varsayımlarla dolduruluyordu; bu puan kalibre kazanma olasılığı değil.
- Bugünkü Cranbourne 8 koşu / 80 atın tamamı koşu+numara+isim+anne+baba ile resmî Racing Australia profiline eşleşti. 67 atta önceki yarış, 13 atta doğrulanmış ilk start; 80 atta ayrı deneme kaydı. Deneme, yarış startı veya atın kendi koşu derecesi sayılmadı.
- Kaynak tarih denetimi, aynı gün/gelecek sonuç dışlama, belirsiz/çift eşleşme reddi ve kazananın derecesini diğer ata vermeme kontrolleri eklendi.
- AU resmî form bağlantısı program/yorum bağlamına ve sürümlü AU eğitim özelliği yoluna eklendi. Günlük Cranbourne form toplama yolu var; diğer AU hipodromları henüz eşlenmedi.
- Kayıtlı Cranbourne yorum gerekçeleri yenilendi; seçim sırası, eski tahmin yakalama zamanları ve sonuç geçmişi yeniden yazılmadı. Model yokken düşük güven ve program puanlaması açıklaması eklendi.
- AU deney çalıştırıcısı tamamlandı ama model üretmedi: insufficient_data, 262 uygun koşu/55 gün; en az 600 koşu eşiği korunuyor. verification.verified boş: yedi modeli geçti diye sunulamaz. AU başarı artışı yok.
- Resmî tarihsel form denemesi 8 tarihin 1'inde dolu kaynak buldu; diğer 7 sayfa boştu. Kayıtlar zorla eşlenmedi.
- Alternatif resmî InteractiveForm/Meeting sonuç bağlantılarından 630 farklı tarih/hipodrom bulundu; 80 toplantı zamana yayılmış olarak ayrı kanıt alanına toplanıyor. Yol: data/external/racing-australia/history/. Ham sonuçlar canlı SQLite'a veya eğitim geçmişine otomatik ithal edilmedi. Kaynak tarihi, tam katılımcılar, resmî at kimliği, mükerrer yarışlar ve yarış öncesinde bilinebilir alanların eşleşmesi doğrulanmalı.
- Mevcut maiden-prize-v2 tamamlandı ve 7 eşitlik kontrolü geçti; aktif model değiştirilmedi. İkramiye train özellikleri hâlâ sıfır: yeni registry kayıtları eğitim dönemini kapsamıyor. Bu, eski ikramiye kayıtlarını toplamanın neden öncelikli olduğunu doğruluyor.
- İlgili AU ve ranking testleri: 10 geçti. Önceki foreign-context + maiden özellik testleri ayrı koşuda geçti. Canlı süreç için reload-api.json isteği yazıldı; uygulandığı sağlık dosyasıyla ayrıca doğrulanmalı.

Sıradaki kabul kapıları:
1. Tarihsel AU kaynak toplamasını bitir ve her hatayı açık raporla.
2. Resmî kimlik ile sonuç–program bağını kur; tam yarış alanı ve DNF/çekilen ayrımını test et.
3. Aynı dönem için idman/deneme, kariyer, sınıf, pist/mesafe, jokey/kilo, takı, zemin ve ikramiye kapsamını ölç; kaynaktaki boşluğu gizleme.
4. Yeterli kronolojik örnek oluşunca sabit arşivle AU adayı eğit; tam canlı/eğitim özellik eşitliği ve bağımsız ileri test olmadan yayımlama.
5. Sağlık, gerçek çalışma şiddeti gibi kamuya açıklanmayan bilgileri varmış gibi işaretleme. İlk kez koşan atın yarış geçmişi 'uygulanamaz' durumudur; eksik kariyerle aynı değildir. Tam veri bile kazanmayı kesinleştirmez.

Sonuç güncellemesi — Avustralya resmî tarihsel kaynak:
- Toplama tamamlanan 7 toplantıda 58 koşunun sonuç alanı ayrı staging arşivine alındı. Henüz kabul edilmiş eğitim girdisi değil.
- 73 başarısız yanıttan 69'u sonradan yerel HTML kontrolüyle insan doğrulaması sayfası olarak sınıflandırıldı; 4'ü kaynak/tarih uyuşmazlığı olarak kaldı.
- Toplayıcı insan doğrulaması algıladığında erken duracak şekilde düzeltildi. Koruma aşılmadı; otomatik tekrar çalıştırılmamalı. Resmî erişim/veri aktarımı çözülmeden bu kol devam edemez.
- Bu 58 koşu, mevcut 262 ile doğrulanmış toplam diye toplanamaz; kimlik, mükerrerlik ve tam katılımcı kontrolleri henüz yapılmadı.

Son doğrulama:
- AU form, ilk start/deneme ayrımı, geçmiş sonuç sızıntısı, mevcut ranking ve ikramiye eksik değer testleri birlikte 12/12 geçti.
- Güncel yorum gerekçeleri ve kanıt sayıları 8 koşu için yenilendi; ilk koşuda withHistory=3, verifiedDebut=4. Eski eksik-geçmiş sayaçları temizlendi. Veritabanındaki geçici yazma kilidi sonrası uygulama ayrı işlemde başarılı oldu.
- Servis güvenli yeniden yüklemeyle yeni PID altında sağlıklı çalıştı. Yorum bellek önbelleği için son kanıt güncellemesinden sonra yeniden yükleme isteği tekrar yazıldı.
- Tarihsel kaynak kolu insan doğrulaması nedeniyle durdu; kullanıcı tarafından çözülmüş resmî erişim veya yetkili veri aktarımı gerekiyor. Toplama sürüyor diye sunulmasın.

## 16 Ekim — devam çalışması: sonuç kabulü, ikramiye ve AU kazanan hedefleri
- Racing Australia insan doğrulaması isteyen uç noktaları tekrar sorgulanmadı. Ana form toplayıcısına da kalıcı kaynak durum kontrolü eklendi; mevcut önbellek çalışır, yeni otomatik istek engellenir.
- 58 ham sonuç koşusu yerel HTML ile yeniden doğrulandı: 543 koşan, 167 çekilen at. 58'inde açık final statüsü/program eşlemesi bulunmadığından bunlar hâlâ eğitime kabul edilmiş tam veri değil. data/external/racing-australia/history/validation-report.json.
- İlk yabancı CSV denemesinde At No sütununun bitiriş sırası olduğu varsayımı yanlıştı: ilk dört sonrası satır sırası kesin bitiriş sırası değil. Bu yolla eklenen yalnız 2026-04-02 Pakenham 1 ve 7 numaralı iki kendi pilot kaydı, sonuç kaynak kimliği ve içerik karşılaştırmasıyla yedeklenip geri alındı. data/maintenance/au-pilot-quarantine-20261016.json. Bu kayıtlar V3'ün sabit girdisinde yoktu. CSV satır sırasından bilinmeyen dereceler üretilmez.
- Ayrı kazanan-hedef veri yolu: programdaki koşanlar ile resmî HTML'deki ilk dört, numara + at adıyla doğrulanır; tek resmî kazanan zorunlu. İlk dört sonrası atlara bitiriş sırası verilmez (finishPosition:null, knownNonWinner:true). Bu hedefler geçmiş form/ilk üç/hız/başlama istatistiklerine eklenmez. Ama birincilik için denetimli hedef olarak kullanılabilir.
- Kaynak: TJK'nin bağımsız resmî program ve sonuç arşivi. AU için ayrı ülke filtresi eklendi; diğer ülke veya yerli toplama varsayılanı değişmedi. Kazanan hedefleri canlı historical_race_data tablosuna eklenmeden data/external/racing-australia/tjk-winner-targets.json içinde tutuluyor.
- Toplama örneklemesi: tarihsel mevcut takvimde Perşembe/Cuma TJK AU toplantıları, 120 gün sınırı. Bu tüm Avustralya yarışlarının kapsandığı anlamına gelmez. Kaynaklar/kimlikler uymayan koşular reddedilir.
- Eğitim okuma yolu, kazanan hedeflerini tam sonuçlu arşivle birleştirir; çakışmada tam sonuçlar öncelikli. Eğitim ve runtime eşitlik doğrulaması, geçmiş hesaplarında yalnız tam sonuçlu kayıtları kullanır. Yarış sonrası/öncesi olduğu kanıtlanmamış hedef hava alanları temizlenir. Sıfır veya uydurulmuş bitiriş, derece ya da pist bilgisi yok; tanınmayan AU yüzeyi null.
- İkramiye: 36 eski resmî TJK programından 284 yeni kayıt, toplam 916→1200. Yerel sonraki arşiv toplaması 1273'e çıktı. AU hedef kaynaklarından 255 ikramiye daha alındığında 1528 oldu; sonraki toplamalarda artabilir. Rutin collect-archived-prizes artık mevcut tarihsel kayıtları korur.
- parseCsv canlı kaynak koduna ikramiye aktarımı eklendi; yetiştirici primi yarış ödülüyle karışmaz. Kaynak kodun API'de kullanılması için olağan güvenli yeniden yükleme gerekir; bugün bu bölüm için henüz istek yazılmadı.
- Sabit girdili prize-history-v3 tamamlandı: TR/US ve iki TR ırkı, 4 runtime parity kontrolü delta=0. TR 195 koşuda aday %31.79/mevcut %32.31; US 260'da %28.08/%30.38; TR Arap 95'te %29.47/%31.58; TR İngiliz 100'de %33/%33. Aktif model değişmedi. İkramiye artık gerçek train vektöründe dolu: TR 232, US 194 at/koşu satırı; kapsam hâlâ sınırlı.
- AU takip işi: server/finish-au-winner-study.mjs, data/maintenance/au-winner-training-followthrough.json. 262 tam sonuçlu + mükerrersiz kazanan hedefleri 600'e ulaşınca hedef/prize/form girdilerini sabitler ve au-winner-target-v2 adayını çalıştırır. Otomatik aktif model terfisi yok. Eğitim raporu ve verification.json görülmeden başarı veya tamamlanmış AU modeli denmez.
- Çalışan komut oturumları: AU toplama 91092; takip/eğitim 40321. Bunlar Windows SYSTEM kalıcı görev değil; oturum/app kapanmasına dayanıklılık garantisi yok. Yeniden başlatmadan durum dosyaları/süreçler kontrol edilmeli, kopya işler başlatılmamalı.
- Doğrulamalar: ilgili AU/ülke filtresi/kazanan etiketleri/piyasa sızıntısı/ranking/ikramiye test grubu 28/28; ek hava sızıntısı testi geçti. Program CSV ikramiye aktarımı ve foreign-context ayrı koşuda 4/4 geçti.
## 16 Ekim — ortak ülke veri denetimi ve canlı aktarım düzeltmeleri
- Kullanıcının önceliği TR/US, aynı veri alanlarıyla GB/FR/ZA da kontrol edildi. server/audit-country-evidence.mjs son programı ülke bazında seçer; FR son önbellek 2026-10-13, diğerleri 2026-10-16. Sayaçlar benzersiz at değil at/koşu satırı. Kaynak varlığı, bağlanmış geçmiş ve özellik kanıtı ayrılır; kayıt yokluğu ilk start kanıtı sayılmaz.
- Türkiye güncel 73 koşan: 69 geçmiş yarış, 70 idman, 70 doğrulanmış anne-baba hattı (anne babası), 59 hız referansı. ABD 266: 198 geçmiş yarış, 227 idman, 55 kendi süreli geçmişi, 41 hız referansı, 178 tempo kaydı. Bunlar tüm kariyerin tamamlandığı anlamına gelmez. Çekilenler nedeniyle ilk ölçümdeki 74/300 ile aynı payda değil.
- GB 90 at: 66 geçmiş, 10 kendi süreli geçmiş, 0 hız/idman. FR 179 at:134 geçmiş, 0 kendi süre/hız/idman. ZA150:147 geçmiş, 0 kendi süre/hız/idman. Hepsinde anne-baba isimlerinin bulunması, anne babası ve resmî yabancı kimliğin tamamlandığı anlamına gelmez.
- TJK soy toplama: 42 denemede 9 yeni doğrulanmış kayıt; 33 başarısız (çoğu timeout), 158 ertelenmiş. Rapor data/external/tjk-pedigree/collection-report.json. Toplayıcı artık daha önce başarı kaydetmiş olsa da art arda 4 taşıma hatasında durur; kaynağa kesintisiz başarısız istek yollamaz.
- Somut canlı eşleme boşluğu: Equibase chart soy kayıtları yalnız tarihsel zenginleştirmede kullanılıyordu. Yeni enrich-runner-pedigree.mjs, bugünkü sıralama ve yorum bağlamında da anne+baba+isim ve önceki kaynak tarihiyle bağlar. 266 US atından46'sına chart anne babası eşleşti; mevcut bir kayıtla etkili toplam47. Çelişen, aynı gün/gelecek, yanlış ebeveyn ve başka ülke kaydı reddedilir. Mevcut damsire üzerine yazılmaz.
- İkramiye iki aşamalı eksikliği: CSV ayrıştırmasına eklenmişti ama saveProgram/loadStoredProgram SQLite dönüşü race düzeyindeki prizeMoney'yi düşürüyordu. restoreProgramPrizes, yayımdan önce aynı şehir/no/pist/mesafe/tam at listesi doğrulamasıyla bunu geri bağlar. 16 Ekim73 koşu ve 13 Ekim arşiv programı ayrıca raw source_snapshots'tan guarded backfill ile dolduruldu; eski sıralamalar/forecast kayıtları değiştirilmedi. Kalıcı yeni yenileme sonrasında yeniden kontrol edilmelidir. Rapor program-prize-backfill.json son çalıştırılan tarihi tutar.
- İlgili yeni/eski testler11/11 geçti; 3 betik syntax check geçti. API güvenli reload talebi yazıldı; analiz varsa supervisor bitmesini bekler. Zorla süreç öldürülmedi.
- Dış kaynak ön incelemesi: BHA resmî sayfa200; sayfada gözlenen genel fixture ucu kimliksiz isteğe418 verdi, ithal0. NHRA resmî sonuç sayfası web aracında403. France Galop arama sayfası tek başına at/yarış verisi kabul edilmedi. Bunlar tamamlanmış yeni kaynak bağlantıları değil; erişim korumaları aşılmadı.
- AU önceki toplama647 uygun hedefe çıktı; v3 denemesi train547/validation11/test39 nedeniyle insufficient_chronological_test; model yok, verification.verified boş, activeModelChanged=false. Sabit seçilmiş dört validation tarihi collectHistoricalDay tarafından0 toplantı döndürdü; sonuç uydurulmadı, validation eşiği azaltılmadı. Bu dört tarihten veri edinildi diye sunulmasın.
- Çalışma oturumları: yeni program yenileme72999; bitmeden kopyası başlatılmasın. AU78070 ve audit88249 tamamlandı. Kalıcı SYSTEM görevi kurulmadı. Aktif modeller terfi edilmedi; başarı artışı iddiası yok.
- Son tamamlanma doğrulaması: program yenileme72999 exit0. Yeni program fetchedAt=2026-10-16T17:03:53.202Z; 73/73 koşuda prizeMoney, ABD46 atta açık damsire alanı mevcut. Kalıcılık yeni tam kaynak→SQLite→ranking→publish turunda doğrulandı. API1344 yeni kodla sağlıklı; sonraki canlı kontrol raporu data/maintenance/country-evidence-live-check.json. İlgili iş tamamlandı,72999 artık çalışıyor diye yeniden beklenmesin.
## 16 Ekim — eksiklere devam, ikinci uygulama
- Yeni collector kapsamı: collect-historical-prizes artık PRIZE_COUNTRIES ve sınırlı PRIZE_MEETINGS_PER_PERIOD (1..20) alıyor; registry'de tüm hedefleri bulunan toplantıları yeniden seçmiyor. 4 art arda kaynak hatasında durur. TR/US40 toplantı334 yeni kayıt; GB15 toplantı106, FR13 toplantı105, ZA20 toplantı164. Toplam1825→2534. Son historical-collection-report yalnız son GB/FR/ZA partisini içerir.
- audit-prize-coverage through15Ekim: uygun2461, mevcut tarihsel yarışlara eşleşen1790. Registry2534'ün hepsi training'e eşleşti diye sunulmaz. Eşleşen TR429/US523/GB217/FR214/ZA288/AU60; diğer ülkeler de ayrı raporda.
- Ek Equibase arşivi304 PDF offline yeniden parse edildi:1841 yarış12892 at satırı. Soy çıkarımı837 mevcutPDF'den7334 kaynak satırı verdi; bunlar benzersiz at veya yeni7334 kayıt iddiası değil.
- Yeni canlı tempo boşluğu: index programPaces ve verifiedPaces yalnız ana arşivi okuyordu; artık readOfficialCharts ile training yöneticisiyle aynı birleşim/doğrulama kullanılır.6472 mükerrersiz resmî yarış47271 satır,0 çakışan alan/0 reddedilen. Aynı261US atında tempo173→176. Yeni/ilgili9 test geçti; ikramiye2 test ayrıca geçti.
- TJK soy ağ denemesi:6 istek1 başarı5 timeout;4 art arda taşıma hatasıyla durdu34 ertelendi. Son2güncel boşluk kaynağı: pedigreeParentIdentity listesindeJPN eksikti. Resmî programdaki SAXON WARRIOR(JPN)/SATONO ARES(JPN), profilsayfasında ülke eki olmadan geliyordu. Parent normalizasyonu ortaklaştırıldı; exact sire/dam ve id kontrolleri korundu. İki önbellek profili offline onarıldı: SECRET OF DRAGON anne babasıAKINDAYIM, DERBY WARRIOR anne babasıMSHAWISH. tr-pedigree-cache-repair.json.7 ilgili soy testi geçti.
- collectHorseWorkouts seçeneklerine hedef horseIds filtresi eklendi; varsayılan değişmedi. Yalnız AYTOR117443/MARISCAL96134/GÜROBASI102038 sorgulandı.3denemede0 doğrulanmış kayıt; ilk2 at+tarih kaydı yok, üçüncütimeout. Yokluk idman yapılmadı kanıtı sayılmaz. tr-missing-workout-collection.json.
- API güvenli reload ve yeni tam program yenileme61692 tamamlandıexit0. evidence-followup-live-check: Türkiye73/73damsire; US261atta176tempo;73/73koşuprize. API supervisor olağan reload sonrası sağlıklı.
- Yeni sabit deney prize-history-v4 oturum41379: registry2534, base maiden-prize-v2; TR/US+TRırkları. Exporting aşaması; tamamlanmadan sonuç denmesin. .migration/audit-prize-v4-inputs.py, exportlar bitincev3ile karşılaştırıp etiket/yarışkohortu ve ikramiyedışı özelliklerin değişmediğini denetler. Diğer aktif modeller değiştirilmedi. Çalışan iş kopyalanmasın; kalıcıSYSTEMgörevi değil.
- Sonuç güncellemesi: prize-history-v4 tamamlandı,41379exit0;4 tam özellik eşitlik kontrolüdelta0,activeModelChanged=false. Girdi auditv3→v4 TR11400/US8651yarışta etiket/alan/ikramiyedışıözellikleraynı. TR1572/US1080 at-satırında güncel ikramiye yeni dolu. TRtrain gerçek prize232→1006/59405; geçmiş dönemin çoğu hâlâ eksik.
- Aynı testte aday/mevcut top1: TR31.28/32.31(195koşu11gün); US26.92/30.38(260/11); TR-arabian29.47/31.58(95/11); TR-thoroughbred36/33(100/11). İngiliz adayının bootstrap95[-2.913,8.828]; seçilen without_maiden_prize varyantı, dolayısıyla yeni ikramiye katkısı iddiası yok. Artış görünen alt grup da yetersiz bağımsız test nedeniyle terfi edilmedi.
- Son ilgili testler tek koşuda16/16 geçti. Tüm bu tur işleri tamamlandı;41379/61692/27811/30445/95189 oturumları artık çalışmıyor. Son kullanıcı raporu outputs/Eksik-Veri-Tamamlama-Devam.md. Ana eksikler eski dönem tam kariyer, bireysel derece/idman, yabancı soy ve yarış öncesi pist/hava; GB/FR/ZA'daki ikramiye artışı bu alanları doldurmuş sayılmaz.
## 16 Ekim — eski dönemlere yayılmış toplama ve Fransa/Güney Afrika soy düzeltmesi
- Kullanıcının yeni devam isteğinde eski eğitim dönemleri önceliklendirildi. `prize-meeting-selection.mjs` aylara yayılan seçim ekler. `collect-historical-prizes.mjs` artık PRIZE_PERIODS ve PRIZE_SPREAD_MONTHS alır; eski varsayılan korunur. Dönem etiketleri toplama örneklemesidir; gerçek model train/validation sınırları rapordan ayrıca ölçülür.
- TR/US ilk 40 toplantı + 10 partilik seri (400 toplantı) tamamlandı: 440 toplantı, 3.624 yeni yarış ikramiyesi, kaynak hatası yok. Seri state: data/maintenance/prize-monthly-backfill-20261016/state.json, phase=batch_series_complete. Bu tarihli seri tekrar otomatik başlatılmamalı; tamamlanmış state nedeniyle betik zaten reddeder. Her parti raporu aynı dizinde saklanır.
- Sonra GB/FR/ZA eski aylar toplandı: GB142, FR133, ZA170 yeni kayıt; toplam445. Chantilly2026-03-30 ve2026-05-31 kaynaklarında yalnız para birimi bulunuyor, tutar yok; iki kaynak kayıt eklenmeden reddedildi. Ham CSV'ler historical-csv altında saklandı. Bu tur toplam4.069 kayıt; registry2.534→6.603. Tüm kayıtlar tam eğitim kapsamı diye sunulmaz.
- Sabit v4 kohortunda kaynak kapsam projeksiyonu yapıldı ve v5 gerçek özellikleriyle doğrulandı: TR train1.006→9.846 /59.405 at-satırı; US678→6.688 /37.757. Kaynak sayısı ile modeldeki gerçek kapsam ayrıdır.
- prize-history-v5 tamamlandı (31415 exit0). Arşiv/etiket/idman/soy/kontrol modeli sabit; yalnız registry snapshot6.603'e çıktı. .migration/audit-prize-v5-inputs.py v4→v5 tüm etiketlerin ve ikramiye dışı özelliklerin aynı kaldığını doğruladı; TR16.596 /US11.738 toplam vektör satırında target ödülü yeni dolu (bunların bir bölümü train dışındaki eski history/warmup dönemidir).
- V5 aday/mevcut top1: TR31.28/32.31 (195 koşu11 gün); US26.54/30.38 (260/11); TR-arabian29.47/31.58 (95/11); TR-thoroughbred36/33 (100/11). İngiliz güven aralığı[-2.913,8.828], seçilen without_maiden_prize varyantı. Yeni ikramiye başarısı diye yorumlanmaz. 4 tam özellik parity delta0, activeModelChanged=false. Ana modeller korunuyor.
- Fransa/ZA kritik kaynak biçimi: Orijin(Anne) sütununda anne ve anne babası birlikte verilmiş (FR: DAM (SIRE); ZA: DAM (AUS)(SIRE (IRE))). `program-maternal-lines.mjs` parantezleri dengeli ayrıştırır, doğum ülkelerini ata saymaz; nested bilinmeyen biçimi reddeder. `verifiedProgramMaternalLine` kaynak URL/date/şehir-koşu-at numarası ve tam at adı+baba+ham anne eşleşmesiyle kabul eder. Ham anne alanı değiştirilmez.
- `collect-program-maternal-lines.mjs` ilk onarım için sabit13EkimFR ve16EkimZA önbelleklerini, mevcut gerçek source_snapshots CSV'leriyle karşılaştırdı: FR179/179, ZA150/150,0 eşleşme reddi. Ayrı registry: data/external/tjk-maternal-lines/records.json. Bu yalnız güncel/seçili program kanıtıdır; tüm tarihsel FR/ZA eğitiminin soy boşlukları kapandı diye sunulmaz.
- Günlük kalıcılık da düzeltildi: index fetchCsvProgram doğrulanmış FR/ZA programında kaynak kanıtını sourceData.tjk.programMaternalLine içinde saklar. database.getProgramForAnalysis bunu yeniden kaynak/ebeveyn kontrolünden geçirerek damsire/pedigreeSource alanına taşır. enrichRunnerPedigree eski önbellek için ayrı kayıtları kullanır. GB ülke kodları anne babası yapılmaz. SQLite round-trip ve sahte eşleşme reddi testleri eklendi.
- Güncel cache yalnız metadata ile güvenli biçimde onarıldı; eski forecast sonuçları ve sıralamalar yeniden yazılmadı. API kaynak kodu güvenli reload ile yüklendi. Elle başlatılan1671 yenilemesi eski CLI'nin sessiz catch'i nedeniyle açıklamasız exit1 verdi; program-refresh artık hatayı stderr'a yazar. Ardından olağan uygulama yenilemesi PID20288 tamamlandı (program_ranking_ready18:14:37Z, profiles_ready18:14:48Z). Gerçek SQLite dönüşünde ZA150/150 kaynak kanıtı doğrulandı. Son kontrol monthly-backfill-final-check.json: API sağlıklı, FR179/179 ve ZA150/150 cache'de mevcut.
- Son ilgili test grubu21/21 başarılı; program-refresh syntax check geçti. Tüm bu tur komut işleri tamamlandı: 34968/99818/5958/12255/31415. Çalışıyor diye tekrar beklenmesin.
- Yeni bağımsız Fransa kaynak incelemesi: resmî France Galop https://www.france-galop.com/sites/default/files/2026-04/26plat07.pdf indirildi; data/external/france-galop/26plat07.pdf ve sha256 kaynak metadatası korundu. PDF becerisi okunup74.sayfa görsel olarak incelendi. Pilot30MartChantilly1 Tonnant, Romanised/EtonnezMoi ebeveynleri,1900m sentetik ile TJK programına eşleşti;15 program atı/15 resmî koşan. Tek kazananın derece/ödül kanıtı ayrı validated-pilot.json'da; trainingAccepted=false ve historyEligible=false. Bülten sonuç sonrası olduğundan target-day ikramiye/hava yerine kullanılamaz. Sonuncu atlara derece veya süre uydurulmadı. Bu kaynak tamamlanmış kariyer bağlantısı değil; resmî geçmiş kanıt toplaması için adaydır.
- Kullanıcı raporu: outputs/Eski-Veri-ve-Soy-Tamamlama.md. Ana sonraki boşluklar: TR/US tam kariyer, bireysel derece, eski idman; GB/FR/ZA'nın tarihsel soy kapsamı ve resmî kariyer bağlantıları; yarış öncesi pist/hava. Yeni current soy alanı her şey tamamlandı anlamına gelmez.

## 17 Ekim 2026 sabah hazırlığı ve yorumlar
### 13.35 eğitim boşluklarına devam
- Yeni pedigree-training-targets.mjs ile result/label kullanmadan eksik soy hedeflerini tarihsel start frekansına göre sıralama eklendi. Valid registry entries/cooldown/çelişkili ebeveynler hariç; race/id tekrarları tek sayılır. collect-tjk-pedigree PEDIGREE_PRIORITY=training_frequency ve explicitprior cutoff destekler; varsayılan current-program davranışı aynı. Yeni mod raporu training-collection-report.json, current raporunu ezmez.
- Bu mod120hedef,through2026-10-04: hedefler5052observedarchivestart. İlk5resmiprofilisteği timeout, stop repeated_source_transport_failure, saved0/deferred115; tekrar çalıştırılmadı. Yeni soy kazanılmış denmesin. Morning training_pedigree stagecurrent_pedigree sonrasında120target/cutoff day-30 ile eklendi; eski eğitim verisine öncelik verir.
- audit-pedigree-recovery.mjs frozenTRfit6557race64482rows'u kendiarchive-days ilebirleştirip güncelregistry'yi trainerileaynıparentvalidation üzerindenkontroletti:7279knownfrozen,%11.29; ek628rows59uniquehorse sourceavailable,%12.26newexportavailability; unmatched0. Kaynak düzeyi projection, actualnewmodelinput/accuracygain değil. Frozen model/root dosyaları korunuyor. Rapor data/maintenance/pedigree-recovery-audit.json.
- Bir40meetingoldtrainprizebatch:323newrace,7753→8076,1sourcefailure (ayrıntı historical-collection-report.json), kalanlarverified. İlavebatchbaşlatılmadı. Yeni6 ilgili test (targetselector2+pedigree3+monthly1) ve syntaxgeçti. DışHTTPSgzip200, Ankara50/100ready. Bu turNodeişleri2936collector/42800auditbitti. Rapor sohbet outputs/Egitim-Verisi-Tamamlama-Devami.md. Başarı artışı henüz doğrulanmadı; activecandidatepromotion yok.
### 13:21 telefon ekranı: seçilen hipodrom sabit kupon hatası düzeltildi
- Hata artık bağlantı değil: Ankara sabit50/100 kuponlarındaki race4 no2LADY GROUND ve5NART THE BATTLE güncel sahada yok. Eski seçili kuponlar16Ekim19:56Z'de,17Ekim12:00Z(15TR) başlayan2.altılı için kayıtlı. selected-meeting-coupons önceki algoritmav1ticket'i bulunca invalid mesajıyla duruyor, güncel kupon üretmiyordu.
- Yeni davranış: doğru date/city/budget family için latestcapturedAt revizyon seçilir, geçerliyse sabit kalır. Invalid ve orijinalscheduledStart geçmemişse yalnız aynıordinal/startRaceNo oyununda optimalHundredTicket yeniden doğrulanır; sha256legs bazlı `selected-meeting-optimal-v1-{budget}-revision-{hash}` ile immutableyeni kayıt, supersedesTicketId ve revisionReason. Eski satır/değerlendirme geçmişi silinmez. Started invalid oyunda yeni kupon yok, açık kapalıoyunmesajı. Resmi başlangıç kaybolursa başkaordinal'e sessiz geçiş yok.
- Yeni server/selected-meeting-coupons.test.mjs2/2 geçti (withdrawal revision, sourceimmutability, budget, idempotence, scoreonlychangefreeze, noafterstart). Publicgateway2/2 degeçti. Ekbroadened src/data/ticketData.test.mjs3testundefinedfilter/length/every ilefail; bu dosya/uygulaması turdahiçdeğişmedi ve önceki dist/src drift ile ilgili. Bu kapsamda eski src yeniden derlenmedi; bağımsız takip gerekiyor.
- meetingCouponShowcase CLI ile gerçekAnkara50/100 yeni revizyonlar store edildi, cost50/100. firstleg7GREEN EYED MEMO ve6FEMALE WARRIOR. revision50fb5b89ed01c8054a/100cd55637b9d00c74f. reload-api marker mevcut güvenli mekanizmayla yazıldı, adminkomutu istenmedi. Yerel8788 ve gerçekdışHTTPS /api/coupon-showcase?date=2026-10-17&city=Ankara200, herikibütçe readytrue/reasonnull doğrulandı. Telefonrefreshsonrasıekranhenüzalınmadı. Rapor sohbet outputs/Ankara-Sabit-Kupon-Duzeltmesi.md.
### Öğle devamı: veri dağılımı ve gerçek başarı
- Telefon gzip yönetici adımı kullanıcı tarafından başarıyla uygulandı (ekran HTTP200 Content-Encoding:gzip). Yeni publicgateway/json-transfer kodu canlı. Kullanıcı normal işlemleri ajan yapmalı, yalnız gerçek Windows admin engelinde kullanıcıya gidilmeli diyor. SYSTEM üzerinden yetki dolandıran broker/komut kapısı kurmayın.
- Sabah eğitimi COMPLETE08:28:33Z, morning runner bitiş08:31:51Z; eski 'çalışıyor' notları tarihsel. TR203/12gün yeni28.08 vsaktif33.99; US292/12gün29.45/29.45. GB210/23gün23.33/program17.62; FR194/21gün21.13/program14.95; ZA214/22gün28.97/program22.43. AU insufficient_chronological_test. Hiçbiri promote edilmedi; holdout tekrar kullanımından ötürü prospectiveRequired korundu.
- `audit-training-evidence.mjs` yeni read-only frozen input ölçümü. TR fit6557races64482rows: history94%,workout93.5%,speed84%,damsire11.3%,prize17.9%,previousClass53.3%. US fit5829races43233rows: history72%,workout0.4%,speed17.1%,damsire12.2%,prize18.9%,previousClass19.2%. US testworkout63.8%,TR/US testprize100%: train/serve eksik veri dağılımı farklı. Causality veya importance kanıtı diye sunulmaz. TR trafficEvidenceCount0 özelliği yalnız externalEvidence.comment okur, mevcut459 steward horse-eventini tüketmez; steward kayıt yok sanılmasın. Şema sürümü olmadan incumbent feature semantiğini değiştirmeyin.
- TJK soy: 74 attempt62saved12timeout, source transport failure stop,126 ertelendi. Current audit230non-scratchedTR:222damsire,228workout,224history. Önceki235paydasından5outofrace düşmüş; artışın tamamını62kayda bağlamayın. Allcountryaudit complete, USownTimed90 güncel.
- TR/US eski fit aylarına dengeli120meeting üçbatch PRIZE_PERIODS=train/spreadMonths1/perPeriod20:989 yeni raceprize,6764→7753. Kaynaklar0failure. Daily maintenance ve morning aynı öncelikli40meeting batchileeskifit boşluklarına yönlendirildi. Morning sonunda training_input_coverage stage yenirootargıyla audit çalıştırır. Bugünkü eğitim frozen kaldı, bu ek kayıtlar sonraki snapshot'a girecek; ikinci rastgele eğitim başlatılmadı.
- US careercharts1Haz–16Eki taraması332chart:92original+211cached,29missingHTTP404,saved0. Herhangi source verification engeli aşılmadı; tamamlanmış kariyer iddiası yok. Prospective report güncellendi: TR13346hit34.59%,US23867hit28.15%. Paired prestart market TR39.10/US34.10 vsmodel34.59/29.48,model üstün değil.
- Bu turun tüm süreçleri bitti (66612soy,20754/96203prize,39143audit,7858prospective). Tekrar beklenmesin. Son3 ilgili test ve syntax geçti. Kullanıcı raporu sohbet outputs/Basari-ve-Eksik-Veri-17-Ekim.md. Ana sonraki hedef: tarihsel soy/idman/süre ve sınıf kapsamı, GB/FR/ZA kaynak bağlantısı; mevcut frozen model için ileri değerlendirme. Yeni veri başarı artışı diye anlatılmasın.
### Aynı gün telefon hata / Malezya kontrolü
- Kullanıcı ekranında Kuponlar sayfasındaki üç kartta Failed to fetch. Yerel8788/api/health ve8790/api/health200; coupon-showcase,daily-ticket,social-coupons200. Uygulamanın sabit HTTPS adresi https://ganyan-zekasi.tailab9792.ts.net/api/health Node use-system-ca dahil ECONNRESET; curl TLS handshake failure. Bu nedenle dış erişim henüz ONARILDI denmesin.
- Tailscale funnel/status named pipe erişimi ve sc query Tailscale AccessDenied5; bu oturum Windows yönetim yetkisi alamıyor. Kullanıcıya async soru ile yönetici PowerShell onarım komutu iletildi. Hazır dosya bu sohbetin outputs/Telefon-Baglantisini-Onar.ps1. Yönetici üyeliği+gateway sağlığı+hesap Running+Self.DNSName beklenen adres eşleşmesi kontrolünden sonra sadece mevcut Funnel8790'u yeniden etkinleştirir; yeni hostname/account değiştirmez, publichealth doğrulanmazsa hata verir. PowerShell parser hatasız. KULLANICI ÇALIŞTIRDIĞINI SÖYLERSE server/check-public-access.mjs ile tekrar ölç. Her sabah runner'a public_access kontrolü eklendi; kayıt data/maintenance/public-access-health.json. Başarısız ağ kontrolü diğer veri/eğitim aşamalarını engellemez fakat günlük raporpartial olur.
- Eski Cloudflare test tüneli logs'da mevcut; HTTPS probe UNABLE_TO_VERIFY_LEAF_SIGNATURE. TLS doğrulaması kapatılmadı ve çalışıyor diye alternatif adres önerilmedi.
- ÖNEMLİ frontend kaynak farkı: dist/index.html index-BARyHu35.js yükler ve gerçek telefondaki yeni kupon-showcase akışı bu bundle'da var. src/main.jsx/raceData.js daha eski olup kupon-showcase UI'sı içermiyor. Bu tur npm build çalıştırılmadı; eski src ile canlı dist üstüne yazılmasın! Uygulama sabit adresi bundle içinde Tailscale domainidir.
- Malezya güncel8 koşu86 at,48 geçmiş yarış. Resmî Selangor race-card sayfası17Ekim12 yerel koşu içeriyor, TJK yalnız son8 koşuyu yayınlıyor (örneğin TJK1 GENRICH1100m); aynı raceNo ile bağlantı YANLIŞ olur. Resmî horse profile örneğinde bireysel Win Time vs Finish Time ayrımı ve geçmiş kariyer var. Ancak sunucudan card ve genrich profili403/explicit blocked sayfası döndürdü. data/external/selangor/source-status.json blocked_by_source_verification/trainingAccepted=false/integrated=false; iki .html dosyası403 hamkanıttır, program/kariyer diye parse edilmesin. Engeli aşma/tekrar indirme denenmedi. Web gözlemindeki profil örneği khao-manee güncel TJK8'de değildir; bu ata pilotmatch yapılmadı.
- commentaryModelCaution tüm yabancı ülkelerde rankingSource local_trained_model değilse low+ülke adıyla program puanlama uyarısı uygular; yalnız AU ile sınırlı eski koruma düzeltildi. refresh-fluent yalnız başlamamış koşulara uygulandı, bu kez76 koşu304picks,5 başlamış korundu. API'de MY8/8 yorum low doğrulandı. Yeni11 test (yorum/AU/publicgateway) başarılı. Kontrollü API reload işareti yazıldı; gateway/frontend yeniden derlenmedi.
- Sabah eğitimi hâlâ çalışıyor, son fazexporting/ZA, kontrol/geliştirilmiş TR veUS exportları geçmiş. Kesilmesin/ikinci iş başlatılmasın. Telefon için gereken kullanıcı yönetici adımı bekleniyor.
- Kullanıcı tüm güncel programları kontrol etme, eksik veri toplama, eğitim ve her gün Türkiye saati09:00 otomasyonu istedi. Codex heartbeat ACTIVE oluşturuldu: `horseride-sabah-veri-e-itim-ve-yorum`, daily09:00, aynı sohbet. Codex açık olmalı. Yeni gerçek giriş `server/run-morning-preparation.mjs`; kendi pid kilidi, günlük aşama raporu/resume, günlük bakım sahibi bekleme ve bakımın sabah sahibiyle çakışmasını engelleme var. Gece bakımını kullanır, güncel program/eksik TR idman/soy/US idman/ikramiye toplar, audit, hipodrom başına async yorum tamamlanma kontrolü ve aday eğitim yapar. Yeni sürüm uzun aday eğitiminden önce mevcut doğrulanmış modelin yorumlarını hazırlar. Kaynak eksikliği tamamen kapandı sayılmaz, dataComplete ayrı alan.
- Bugün10 hipodrom81 koşu, tüm yorumlar API'de81/81 hazır. Başlamamış77 koşu308 adayın gerekçesi `refresh-fluent-commentaries.mjs` ile değişti; ilk4 Selangor koşusu başlamış olduğu için korunuyor. Aday sırası, sayısal tahminler, forecast geçmişi ve eski createdAt değiştirilmedi. Kaynak kaydının öncesi `data/maintenance/commentary-backups/2026-10-17` altında. explanationUpdatedAt ayrı; evidence-v3-fluent. Örnek API Ankara doğrulandı.
- Yeni `recent-load-evidence.mjs` yalnız geçmiş tarihli gözlenen start/dinlenme/idman ve kilo/mesafe farkını yorum bağlamına ekler. Yeni sayısal özellik şeması eğitildi diye sunulmasın; modelin mevcut mesafe/dinlenme/kilo özellikleri ayrı. Yorumlarda form+pist/mesafe+somut rakip kaydı+kilo/dinlenme akıcı bağlanır; yarış yoğunluğundan sakatlık/yorgunluk türetilmez, eksik kariyer ilk start sayılmaz.
- TJK soy kolektörü161 denemede129 doğrulanmış kayıt ekledi,32 timeout,39 batch ertelendi. Bugünkü TR235 atın anne babası36→165. Hedefli TR idman çalışmalarıyla210→232/235; kalan3 için kaynak timeout var. TR yarış geçmişi229/235. ABD228 at: geçmiş179, idman186, anne babası76, kendi süre91. GB86: geçmiş72,idman0,anne babası0; ZA78: geçmiş67,anne babası78,idman0. MY86: geçmiş48; CA79: geçmiş57. Audit artık güncel programdaki ilave ülkeleri de kapsıyor. FR son program13Ekim, AU16Ekim; bugünmüş gibi sunulmasın.
- Resmî US idman koleksiyonu381 sayfa,18181 arşiv satırı,8487 okunan satır,0 hata,26Eyl–16Eki. Kaynak kapsamı artışı her güncel ata eşleşme garantisi değildir.
- Geçmiş ikramiye kolektöründeki sabit30Eyl kesimi kaldırıldı: varsayılan dün, örnekleme dilimi göreli26 gün; örnekleme train/validation etiketi model split'i değildir. Dated frozen çağrılar env ile korunabilir.161 yeni yarış ikramiyesi, toplam6764. Günlük bakımın intelligence eğitimine bu registry'yi geçirmeme sorunu düzeltildi.
- ŞU ANDA UZUN İŞ: `data/intelligence-models/2026-10-17/morning` aday eğitimi çalışıyor; önce incumbent control ve intelligence exportları sonra CatBoost seçim/eval/parity. Son bakış11:10TR fazexporting/TR, control/TR/TR-training.json yazılmış. Scriptintelligencevarsayılan ülkeleriTR,US,GB,FR,ZA,AU; AU geçmiş winner-target ve form registry snapshot'ı alır, insufficient_data/test sonucu normaldir, hiçbir gate düşürülmedi. Etkin model değiştirilmedi; başarı artışı henüz ölçülmedi. `data/maintenance/morning-2026-10-17.json` ve root training-state/training-report kontrol edilmeden tamamlandı denmesin. Devam eden sabah pid kilidi varken ikinci eğitim başlatılmasın. Bu turun terminal oturumu69365 ana iş,32326 son audit; diğer kolektörler tamamlandı.
- İlgili22 test+yorum/AU8 test geçti, yeni scriptlerin syntax kontrolü geçti. API kontrollü reload sonrası sağlıklı. Rapor `outputs/Gunluk-Kontrol-17-Ekim.md` (bu sohbet outputs klasörü).

## 17 Ekim 2026 — şehir kuponları ve bütçe düzeltmesi
- Canlı API ve dist güncellendi, tarayıcıda doğrulandı: şehir kuponları 30 TL, 50 TL ve 500–1000 TL geniş. Şehre ait 100 TL kaldırıldı; genel günün kuponu 100 TL ayrı özelliktir.
- Ankara gerçek maliyetler 30/50/1000 TL; İzmir 30/45/990 TL. Geniş kupon model olasılık kapsamını bütçe altında eniyiler, tek misli. Kazanma garantisi/kalibre başarı yüzdesi değildir.
- Her ayakta surpriseSuggestion; veri destekli sürpriz ve model alternatifi ayrılır, koşmayanlar dışlanır. Öneri kupona zorunlu eklenmez, bütçeyi değiştirmez.
- ticketData sayısal modelden yorum beklemeden aday üretir. database mevcut kupon kaydında gereksiz yazma kilidi almaz. 14 ilgili test geçti; bütçe 20→50 UI kontrolü geçti, tarayıcı hata kaydı boş.
- Kaynaklar: src/data/couponSurpriseSuggestion.js, ticketData.js, server/selected-meeting-coupons.mjs, application-report.mjs, database.mjs; ilgili testler.
- DİKKAT: src eski olduğundan tam Vite build yapılmasın. server/build-coupon-ui-patch.mjs kontrollü kupon yaması üretir. Yedek .migration/coupon-ui-v2; canlı entry index-coupon-v2-adcf413bccdf.js. API kontrollü reload tamamlandı, yeni üç tier canlı doğrulandı.
- Telefon APK 1.31 UI yerel paketli. Bu PC'de SDK ve mevcut imza anahtarı yok; kullanıcı önceki PC'de olduğunu doğruladı. Önceki PC adı/IP ve mevcut SSH bağlantısı soruldu, yanıt bekleniyor. Yeni APK üretilmedi, telefon UI güncellendi denmesin. Kaynak build.gradle 1.19 eski; eşleşen kaynak önceki PC'den alınmalı.
- Devam eden günlük bakım/tarihsel veri işini kesmeyin ve çift eğitim başlatmayın.
- Ekran kanıtı bu sohbet outputs/Kuponlar-Yeni.png.

## 17 Ekim 2026 — bu PC'de Android derleme ortamı
- Kullanıcı önceki PC'ye bağımlılık olmadan tüm APK işlemlerinin bu bilgisayarda yürütülmesini istedi.
- Resmî Temurin Java21.0.12.1+1, Gradle8.14.3, Android cmdline tools15859902, SDK platform36, platform-tools37.0.1, Build Tools35.0.0/36.0.0 indirildi. İndirmeler resmî manifest/üretici checksum'larıyla doğrulandı.
- Kalıcı araç dizini C:\Users\desscartes\Documents\Codex\tools\android; JAVA_HOME/ANDROID_HOME/ANDROID_USER_HOME/GRADLE_USER_HOME build betiğinde ayarlanır, sistem PATH değişmez.
- server/build-android-local.ps1 bağımsız .migration/android-local/project klasöründe mevcut dist'i paketler; eski src ile Vite build YAPMAZ, dist/downloads APK arşivi pakete alınmaz. cap update android ile eksik Cordova/Capacitor dosyaları üretildi; canlı dist korunur.
- Mevcut APK 1.31 versionCode32 packagecom.horseride.app. Debug sertifika SHA256 FF2541666A7435C287607BF1EFC1FF11C29202250A16CEE5868ECB499CABEDAE. Bu sertifikanın özel anahtarı yerelde bulunamadı; APK'den özel anahtar çıkarılamaz.
- Yeni hedef 1.32/code33. İmzasız release derlemesi sürüyor; başarısı logdan doğrulanmalı: bu sohbet work/android-toolchain/build.log. Yeni imza oluşturulmadı, APK yayımlanmadı.
- Kullanıcıya ayrı paket kimliğiyle yan yana kurulabilen yeni sürüm (eski uygulama silinmeden) veya eski anahtarı aktarıp mevcut uygulamanın üstüne güncelleme seçenekleri soruldu, cevap bekleniyor. Cevap olmadan eski uygulamayı silme/anahtar uyumluymuş gibi yayımlama yapılmasın.

- SONUÇ: Yerel assembleRelease BAŞARILI (3dk10sn,123 görev). İmzasız 1.32/code33 üretildi; index ve kupon JS/CSS modülleri canlı dist ile byte düzeyinde eşit, gömülü APK arşivi yok. Telefon kurulumu/imzalama henüz yapılmadı. Derleme çıktısı .migration/android-local/project/app/build/outputs/apk/release/app-release-unsigned.apk. İmza seçimi kullanıcı yanıtını bekliyor.


## Ayrı kurulabilen APK — tamamlandı
- Kullanıcı eski uygulamayı güncellemeden yeni APK kurulmasını onayladı.
- Paket com.horseride.local, ad Ganyan Zekası Yeni, sürüm1.32/code33. Native namespace com.horseride.app korunur; applicationId, provider authority, strings/custom scheme ve Capacitor appId ayrıdır.
- Java/SDK/Gradle ile yerel release başarılı. APK v2/v3 imzası ve zipalign doğrulandı. Canlı dist index byte eşleşmesi, yeni appId ve APK arşivinin pakette bulunmadığı doğrulandı. Gerçek telefona kurulum/çalıştırma henüz gözlemlenmedi.
- Kalıcı anahtar C:\Users\desscartes\Documents\Codex\tools\android\signing\horseride-local.p12. Parola password.dpapi ile aynı Windows kullanıcısına bağlı şifreli; anahtar/parola çıktılara ve public klasöre kopyalanmaz. identity.json sertifikayı sabitler; sonraki build farklı anahtarı yayımlamasın. Bu signing klasörünün silinmesi ve Windows hesabının kaybı güncelleme kimliğini kaybettirebilir; özel dosyaları kamuya açmayın.
- Sertifika SHA256 32f2695bd73e000c2eeb756058ff799da54d500cf4168676759c6d3b47a96b6f.
- Tek komut: server/build-android-local.ps1 -Sign. Eski src ile npm build yapılmaz; bu betik güncel dist'i alır. Yeni sürümlerde VersionName/VersionCode artırılsın.
- APK outputs/GanyanZekasi-Yeni-1.32.apk ve dist/downloads/GanyanZekasi-Yeni-1.32.apk. Public indirme https://ganyan-zekasi.tailab9792.ts.net/downloads/GanyanZekasi-Yeni-1.32.apk gerçek GET ile indirildi, SHA256 eşit: ed3a41509616629ac2e5ab03db087a1ac01574bec7e733e2bcc8332930f4090c.
- Önceki PC artık bu ayrı uygulamanın derleme/imzalama akışına gerekli değil. Eski com.horseride.app üzerine kurulmaz; eski uygulama korunur.

## 18 Ekim — başarı iyileştirme planının ilk uygulamaları
- Servis: coupon-process.mjs/coupon-worker.mjs ile kupon DB+DP işlemleri ana API'den ayrıldı; aynı talepler birleştirilir, max2 işçi,15sn önbellek, program revizyonunda/başlangıçta geçersizleşir. index.mjs /api/coupon-showcase await readCouponShowcase kullanır. Social toplama HTTP işçisine bağlı değil, mevcut prestart kolektöründe devam eder. http-performance.mjs ana API yanıtları/event loop ölçümünü data/maintenance/http-performance.json'a yazar.
- Kontrollü10örnek/endpoint benchmark kupon p95/en yüksek1063→456ms, hata0; uzun dönemSLO veya telefon uçtan uca testi değildir. server/benchmark-public-api.mjs, data/maintenance/api-benchmark-before/after.json.
- Ölçüm: prospective-outcomes.mjs resmî derecesiz0 sonucu bilinen kayıp kabul eder; bilinmeyen0 eksik kalır. prospective-metrics koşmadığı bilinen atları ayırır, top3/eksik sonuç nedenlerini ve aynı kadrolu piyasa kıyasını raporlar. TR145yarış34.48% (önce133yarış34.59),US238yarış28.15; bu model artışı değil ölçüm düzeltmesiydi. Sonraki gecenin raporları güncel sayıları içerebilir.
- Veri:17Ekim akşamı40TR/US tarihsel toplantı örneklemesinden321 resmî ikramiye kaydı eklendi8404→8725. source report sonradan günlük bakımca yenilendi; bu turun work/historical-prizes-evening.log kanıtı korunur. Gece kapsam9373'e çıktı.
- coverage-v1-evening çalışması tamam+tam runtime parity0: TR203/12gün aday29.56 vs33.5;US292/12gün28.77vs30.14;TRİngiliz105/12gün38.1vs35.24 fakat bootstrap[-2.941,10.101],yayına yetmez. Etkin model değiştirilmedi. Dondurulmuş input-coverage.json eklendi. Sabah girdisine görefitprizeTR17.9→24.7,US18.9→26.2;TRdamsire11.3→12.4. Bunlar doğruluk artışı değildir.
- TJK eğitim-frekansı40hedef/1935start kolektörü5timeout0ekleme sonrasıdurdu; profil .NETpilotuda20s timeout. ABD eskiidman3tarihliHTML404,canonicalprofile200verification/blocked. Engel aşılmadı ve boşluk doldurulmuş sayılmadı. Güncel resmî idman arşivinin günlük saklanması sürer.
- run-intelligence-training.mjs genel tek-iş kilidi+otomatik eğitim-kapsam raporu kazandı. audit-training-evidence.mjs ülke listesi+isteğe bağlı output destekler. Koordinatör aktifmodeli yükseltmez.
- Gece18Ekim study data/intelligence-models/2026-10-18/2026-10-17T21-00-53-703Z 60dk zaman sınırındaTRaltmodellerde kesilmişti. resume-intelligence-study.mjs yalnızTR-arabian,TR-thoroughbred eksiklerini tamamladı; tüm8artifact runtimeparityden geçti (AU yetersizkronolojiden modelyok). state COMPLETE2026-10-17T23:20:37Z. Günlük bakım trainingRecovery/resolvedErrors güncellendi; diğer2hata(yabancısonuç ve soy)korunur. daily-maintenance artık120dk sınır+yalnızfitting/verificationtimeout durumunda donmuşgirdilerle1resume yapar; veri fingerprinti değişirse refit reddedilir. Aktifişe ikinci eğitimbaşlatma.
- Gece sonuTR227/13gün28.19vs33.04,US308/13gün29.87vs30.52;TRİngiliz118/13gün33.9vs34.75. Bu nedenle tek altgrup iyi sonucuna göre seçim yapılmadı,aktifmodel değişmedi.
- Kalıcı gelecek izleme: prospective-model-pin.mjs/register-prospective-study.mjs önceki doğrulanmışcoverage-v1-evening TR,US,TR-arabian,TR-thoroughbred adaylarını2026-10-17T23:13:31.839Z'de shadow_only olarak sabitledi. data/intelligence-models/prospective-*.json sonrakigün latestpointerıyla değişmez; model+raporSHA doğrulanır. Sabit çalışma bitmeden bu pinleri değiştirmeyin/silmeyin. Bu modeller kuponlarda kullanılmaz.
- ranking.loadIntelligenceShadowModel pinnedpointerı tercih eder; index.mjs recordIntelligenceForecast helperını kullanır. Yeni çalışma inputhash namespace'i, skor imzaları ve aynı gerçekcapturedAt ile mevcutmodel kontrolünü de saklar; eski kayıtları değiştirmez. saveForecastSnapshots yarışöncesi koruması devam eder.
- report-pinned-studies.mjs/pinned-study-metrics.mjs yalnızpinsonrası+yarışöncesi kayıtları sayar;aynıkadro ve120sn içindeki en yakın mevcutmodel kaydıylaeşler. Min21sonuçlugün/300eşleşenyarış yalnızgerekliörneklemkoşuludur,otomatikyayın yok. capture-prestart.mjs mevcut20dk sistemişinde raporu yeniler. İlk raporda yeni gözlemler0; ileride kayıt birikimi gerçek rapordan doğrulanmalı, ölçülmüş kazanç denmesin.
- equibase-workouts age eşleşmesi doğumyılıyla yapılır;2yaşAralık→3yaşOcak önceki90gün idmanı kaybolmaz, farklıyaşkohortu reddedilir. Testgeçti. Bu değişiklik bugünün aynı-yıl kayıtlarına yeni veri eklemez.
- Testler: kuponworker/revizyon/başlangıç,scopegateway,sonuçölçüm,pinmutasyon/dailypointer,aynıankarşılaştırma,ocakidman eşleşmesi ilgili testler geçti. Canlıservis ölçümündehealth458istekte5xx0,p95son300içinde1ms. YeniAPK gerekmedi; backend/modeldeneyaltyapısı değişti.
- Sonraki öncelik: kaynak erişimi olan gerçek tarihsel idman/kendi süre/soy akışı;başarı garantisi verme veya yayın kapılarını düşürme. Tekrarlanan test döneminde tekrar ayar yapma. Yeni snapshot+predeclared deney+ileri dönem ölçümle ilerle.

## 18 Ekim 14:48 — eksiklere devam
- Sabah orchestrator partial: son program adımı database is locked; 10 hipodrom81koşu yorumları ve morning eğitimi tamam. Eski hata kaydı silinmedi.
- program-refresh.mjs SQLite busy/locked için en fazla3deneme,1/2sn bekleme; diğer hatalar tekrar edilmez. sqlite-retry.test.mjs2test geçti. Manuel güncel program yenilemesi exit0, cache14:47:05 güncellendi.
- collect-program-maternal-lines.mjs tarih argümanıyla bugünün tüm ülkelerini işler; eski varsayılan geriye uyumlu. Resmi CSV tarih/hipodrom/at/baba/anne kontrolleri korunur. Sabah akışına program_maternal_lines aşaması eklendi.
- enrich-runner-pedigree.mjs FR/ZA kısıtı kaldırıldı; yalnız verifiedProgramMaternalLine kanıtıyla diğer ülkeler kabul. Güncel sahada IE28,US2 kayıt doğrulandı; FR94,ZA81 doğrulandı. MY/CA0,TR0 bu CSV biçiminden; diğer kaynaklar ayrı. Aynı veri sayısını yeni kayıt artışı gibi sunmayın.
- 8soy/SQLite testi geçti. data/maintenance/program-maternal-verification-2026-10-18.json kanıt. Kaynak tarihlerinde yayımlanmış programları değiştirmez; eski tahminleri yeniden yazmaz. API kontrollü reload istendi.
- morning aday TR227/13gün29.52vs32.60;US319/13gün29.15vs30.72. Aktif model değişmedi. EskiUSidman/kendi süre,TRsoy ve yabancıidman/tempo açık. Bu eklemeler için başarı artışı ölçülmüş değildir.

## 18 Ekim — tüm altılılar ve yüzde göstergesi (1.33)
- selectedMeetingCoupons artık resmî başlangıç başına30/50/1000TL üçlü satır üretir. Tek bütçede ilk altılıyı seçme kaldırıldı; saved araması ordinal+startRaceNo ile izole. Her oyunda DP bütçe altındaki model kapsamını maksimize eder. Önceki kayıtlar korunur; başlamış oyunda yeni seçim üretmez, ikinci oyunu bastırmaz.
- UI .find(budget) kaldırıldı; tüm satırlar ordinal-budget anahtarıyla render edilir. Her kartta altılı sırası, koşu aralığı, Tahmini tutma yüzde gösterilir. estimatedChance=ayak normalize model kapsamlarının çarpımı; calibrated:false, detaylarda gerçek kalibre edilmiş başarı oranı olmadığı açık. Yeni kesinlik/başarı garantisi yok.
- 9selected-meeting/coupon-process test geçti; çiftaltılı,ilkoyun kayıtlıyken ikinciyi üretme,ilkoyun başlamışken ikinci,DP optimum,çekilme revizyonu/immutability,cache kontrol.
- dist/assets/index-coupon-v2-431faf94890d.js guardlı legacy patch ile yayımlandı; eski src fullbuild yapılmadı. API kontrollü reload;pid4284,healthy. CanlıAdanaAPI ve DOM6kart/ikiordinal/yüzdeler doğrulandı.
- Android1.33/code34 com.horseride.local aynı imza32f2695... ile başarılı,zipalign+imza+gömülüindex doğrulandı. outputs ve dist/downloads/GanyanZekasi-Yeni-1.33.apk;SHA256449264342ad8d6f89d4a357f16716d79f52404a881d5a30c0d024b6e10b1e137. Telefona kurulum gözlemlenmedi.

## 18 Ekim17:00 — yabancı hipodrom hava kapsamı
- race-forecast.mjs eksik Fairview,Leopardstown,Woodbine,Perak konumları eklendi; Longchamp→ParisLongchamp aliası ve Türkçe/ASCII ad eşleştirmesi. forecastLocation normalize edilmiş tam ad+ülke üzerinden; bilinmeyen hipodrom tahmin edilmez. TorontoOntario/IpohPerak/DublinLeinster/PortElizabethEasternCape ülke+bölge doğrulaması korunur. Yeni konumların resmiadres kaynakları snapshotta addressSource olarak saklanır.
- Doğrulanan kaynaklar https://woodbine.com/contact-us/ ; https://www.perakturfclub.my/ ; https://www.4racing.com/venues/fairview/ ; Leopardstown resmi course guide. Bölgesel yerleşim hava tahmini, hipodrom noktasal ölçümü veya resmipist değildir.
- Eski hava raporu13:56Z55gelecek/36eşleşme;14:00Z54/54. Başlamış yarışlar geriye doldurulmadı. CanlıWoodbineAPI TorontoCA sıcaklık16.3C/rüzgar24kmh14:00Z snapshotı doğrulandı. Perak bugünbitmiş olduğundan0; eşleme sonraki yarışlara hazır, geçmiş doldurulmadı. Kaynakta olmayan resmi pist durumu eklenmedi.
- Sayısal model ve önceki tahminler değişmedi. Hava numericModelUsed:false; sonraki yorum/prestart arşivi için. Program aynı dosya revizyonu korunarak yayımlandı, eşzamanlı değişirse overwrite reddedilir. Kontrollü APIreload istendi.
- Aynı anda süren günlük intelligence işi13:58Zcomplete/errors[]; ikinci iş başlatılmadı. Son study2026-10-18T12-59-01-868Z TR227/13gün29.52vs32.60;US319/13gün31.03vs30.72. US+0.31puan yeterli kanıt değil, aktif yükseltme yok. Registry10663; bunun tamamı bu turun veri eklemesi değildir.

## 19 Ekim — açıkları adım adım kapatma
- review-manifest10dosya eski/yeniSHA kontrolü ve .migration/review-19-ekim-20261019-152534 yedeğiyle canlıya uygulandı. Kuponcache iç içe başlangıç sınırı, foreign export zorunlu/donmuş kaynak dosyası hatasında failclosed,4hava konumu,çok küçük yüzde etiketi ve kalibre edilmemiş ifadesi.10test geçti. LegacyUIentry index-coupon-v2-2865d6b7595c.js üretildi,APIreload/healthy(pid17028) doğrulandı. Sayısalmodel terfi yok.
- 19Ekim12:31Z yeni hava toplama68gelecekkoşu/68eşleşme,failures[]. SantiagoCL,GowranIE,MahoningUS,WolverhamptonGB tekil ülke/bölge geocode ile gerçek veri aldı. Başlamış koşular geriye doldurulmadı. Hava bölgesel,officialgoing veya numericmodelusage değil.
- TR/US trainperiod,monthspread40toplantı338resmiikramiye eklendi:TR20/167,US20/171;11656→11994;failures[]. data/external/race-prizes/historical-collection-report.json. Eski dondurulmuş eğitim girdileri ve modeller değiştirilmedi; sonraki planlı ihracatta kullanılacak,başarıartışı ölçülmüş değil.
- Android1.34/code35 com.horseride.local başarılı;aynısertifika32f2695... doğrulandı. Sorun JDKPipeImpl/UnixDomainSockets Invalidargument; sandboxTEMPuzunluğu. build-android-local.ps1 yalnızJVM için .migration/jvm-tmp ve jdk.net.unixdomain.tmpdir/java.io.tmpdir kullanır;güvenlik/ağ sistemi değişmez. IPv4denemesi çözmedi; kısaTMP çözdü. Varsayılan sürüm1.34/code35 güncellendi. Önceki imzalıAPK1.33 korunur.
- 1.34APK dist/downloads ve bu sohbet outputs içine kopyalandı. Telefonda kurulum gözlemlenmedi. Büyük açıklar USeskiidman/bireyselderece,TRsoy ve yabancıofficialgoing sürer; engelli kaynakları aşma, uydurma veya terfi kapılarını düşürme yok.

## 19 Ekim — veri açıklarına devam (12:46Z)
- Ağsız TRsoy kurtarma pilotu: son donmuşTRfitdönemi2025-09-05..2026-10-04 içinden kayıtlı resmi profili olan200eksikhedef seçildi; source_snapshots indeksinden URLbaşınaençok3snapshot okundu. parseTjkPedigree atID+anne+babayı doğrular,çelişkiliataları reddeder.200denemede0doğrulanmışyeni kayıt; registry değiştirilmedi. data/maintenance/cached-pedigree-recovery.json. Aynı200kaydı kaynakdeğişmeden tekrar taramayın; bu kontrol soy açığını kapatmadı. Yardımcı betik sohbet work/recover-cached-pedigree.mjs,canlı günlük akışa eklenmedi.
- ABDidman eşleşmesi: 20303kayıt ve bugününUSkoşanlarında ülkesoneklerinden dolayı kaybolmuş ek ad eşleşmesi bulunmadı; kimlikkuralları gevşetilmedi. Equibaseeski profil doğrulamaengeli biliniyor, aşılmadı. AyrıEquinelinefree5cross kaynağı pilotu403; engel aşılmadı,kayıt eklenmedi.
- ResmirollingUSidman kolektörü330sayfa hatasız; archive20303→20306 (+3),from2026-09-26 through2026-10-19. FetchedRows7703 toplamnew değildir. Aynıgün idmanları aynıgün yarışına kullanılmaz; modeller/donmuş çalışmalar değişmedi. data/external/equibase-workouts/records.json raporu12:43:08Z.
- 17–18Ekim foreign sonuçları yeniden kontrol:49+56=105kabul/upsert;105yeni demeyin. MY17Selangor8ve18Perak8koşu,IE18Leopardstown1koşu eksik. data/foreign-history-progress-2-2026-10-18.json. Tam günlük kapsam bayrağı false korunur.
- MY17–18için buildWinnerOnlyTarget ile ayrıwinner-onlypilot her iki günde0hedef/8ret verdi; kaynak tamkadroyu/kimliği doğrulamadı. Eksik sonuç pozisyonları oluşturulmadı. data/external/racing-malaysia/winner-collection-report.json, tamtarihselgeçmiş değil,aktifmodel girdisi değil.
- 11winner-only/soyhedefi/idman testi geçti. Etkin model terfisi veya ölçülmüş başarı artışı yok. Sonrakiadım bu kaynaklar için izinli tamidman/performans/soy akışı; mevcut başarısız içerikleri tekrar tekrar tarayarak kapsam varmış gibi sunmayın.

## 19 Ekim — Git senkronizasyon hazırlığı ve model kapsam tanısı
- Hedef kullanıcı tarafından onaylandı:https://github.com/desscartes/horseride.git main; öncekiHEAD236743c. Canlıklasörde .git yoktu; kaynaklar uzak geçmişi koruyan ayrı tamklonda hazırlanır. Veri/anahtar/model/SDK/APK gönderilmez.
- production-ui/bootstrap sürümlenenbaseline+base-entrySHA ile eklendi. build-coupon-ui-patch.mjs artık boşcheckout'ta bubaseline'dan dist üretir, .migration yedeği zorunlu değil. Temiz üretim+tekrarüretim aynıJSindex-coupon-v2-2865d6b7595c.js verdi. Üçüncüpartilisansmetinleri korundu. .gitattributes baselinebyte'larını Git satırsonu dönüşümünden korur. Eskiandroid:sync korumayla durur; build:production-ui ve android:build:local komutları eklendi. .env.example yerel sağlayıcıyı seçer; gerçek.env değişmedi.
- evidence-coverage-drift.mjs audit-training-evidence.mjs içine bağlandı; günlük rapor fit/test alanbulunurluk farklarını uyarır, model/terfikuralı değiştirmez. USidman0.4→66.6%,ikramiye38→100%,olaynotu36.8→66.9% dağılımfarkı açık. 2tanı testi geçti. Eski dondurulmuş veriye tanı raporu data/maintenance/training-evidence-diagnostic-2026-10-19.json.
- Yeni40TR/UStrain toplantısı335resmiikramiye (TR174,US161),11994→12329,0hata. Yeni eğitim bu tur başlamadı; doğrulukartışı ölçülmedi.
- Tamizoleklon testinde165kontrolden4eskibeklenti çıktı: hamteknikhatanınAPI'de görünmesi ve arkaplanrankdeğişimindeödenmişyorumun atılması bekleniyordu. Testler mevcutdokümanteimmutableyorum/temizhata sözleşmesine uyarlandı; gerçekmodelkimliği,kilo,çekilmegeçersizleştirmeleri korunur. Runtimepolitika değiştirilmedi. Tamtestyeniden çalıştırılır.

## 20 Ekim — sanal altılı simülasyonu ve dış erişim
- Simülasyon sekmesi eklendi. Haftalık Pazartesi 1.000 TL sanal harcama, kalan bütçe/kalan gün oranı günlük sınır; kazanç tekrar harcanmaz. Resmî, başlamamış, tüm ayakları local_trained_model oyunlar arasında iki farklı oyunun model kapsamlarının toplamını günlük sınır altında eniyiler. Yüzdeler kalibre değil. Bir uygun oyun varsa tek, uygun yoksa kayıt üretmez; sonraki 20dk işinde yeniden dener.
- simulation_days + application_tickets aynı BEGIN IMMEDIATE işleminde immutable günlük rezervasyon. Haftalık sınır, aynı gün çift kayıt, maliyet eşitliği ve gerçek kayıt anında başlangıç kontrolü; geçmişe tahmin yok. Simülasyon mevcut normal kupon performans raporundan ayrıdır. Resmi sonuç/ikramiye mevcut settleApplicationPayouts ile; eksik ikramiye sıfır kazanç diye kapatılmaz.
- Günlük morning ve capture-prestart 20dk işine captureSimulation eklendi; mevcut gün kaydı değişmez. Bugün 12:34TR Finger Lakes ABD 1.altılı90TL (%3.4116) ve 2.altılı72TL (%2.1159), toplam162, hafta838 kaldı. 11 ilgili test geçti. İlk SQLite busy30sn beklemeyle geçti; yeni işlerde bounded retry var.
- APK1.35/code36 aynı yerel imzayla üretildi; gömülü index/simulation modülü dist ile byte eşit. dist/downloads/GanyanZekasi-Yeni-1.35.apk. Telefon kurulumu gözlemlenmedi.
- API12140 yeni simulation endpointi sağlıklı. Public gateway1328 eski kodla çalışıyor; /api/simulation404, mevcut kupon uçları200 (~0.5sn ilk). Yeni gateway kodu bu endpointi allowlist'e alır, yönetici yeniden yüklemesi gerekir.
- DışHTTPS ECONNRESET/TLS handshakefailure; yerel8788/8790healthy. Tailscale Funnel443 off/on düzeltemedi. Restart-Service ve Stop-Process WindowsAccessDenied. .migration/repair-https-20261020.ps1 UAC RunAs ile açıldı; kullanıcı yönetici onayı bekleniyor. Betik mevcut gateway görevini kimlik kontrolüyle yeniden yükler, APIpid/script doğrulayıp supervisor restart, Tailscale restart ve dışhealth doğrular. Yönetici onayı ve gerçek dış200 olmadan düzeldi denmesin. Sonuç data/maintenance/https-repair-2026-10-20.json.

## 20 Ekim 18:48 — telefon veri erişimi
- Eski Tailscale hostname Google DNS Status3/NXDOMAIN; yerelde74koşu. Kullanıcı Cloudflare geçici yayını açıkça onayladı. Yeni geçit8793(pid21804) ve cloudflared(pid3740), HTTPS https://dna-states-sensitivity-logging.trycloudflare.com . Dışhealth200,races74,simulation200/spent162,özel.env ve adminbacktest404. Telefon Sunucu bağlantısı ayarına bu adres kaydedilmeli; uzaktan telefon ayarı değiştirilmedi. public-address.json güncellendi. Geçici tünel yeniden oluşturulursa adres değişir. Eski8790/8443 korunur. Kupon showcase ilk istekte503; program akışı doğrulandı.

## 20 Ekim — düşük kupon başarısı incelemesi
- Güncel morning frozen test TR252/15gün aday29.37/aktif32.14;US366/15gün29.51/30.33. Yeni aday daha iyi değil, aktif değişmedi. GB209/23gün22.01/16.75;FR171/19gün24.56/15.79;ZA215/22gün33.02/24.65; örneklem/ileri doğrulama kapıları korunur. Pin ileri TR24eşleşme8/8,US45eşleşme11/12,2gün; üstünlük kanıtı yok.
- audit-coupon-quality.mjs immutable seçimleri ve resmîsettlementi denetler; identical selections/stake acrosssources dedup, correlated kuponlar bağımsız deney sayılmaz. İlk99settled1won, ortalamamodel1.3447%. Sonuç metadata kurtarma sonrası119settled2won (%1.6807), modelortalama1.3925%; bu model iyileşmesi değil, eksik rapor kapsamı düzeltmesi. Bekleyen181kayıt kayıp sayılmaz. Dosya data/maintenance/coupon-quality-2026-10-20.json; morning coupon_quality aşaması eklendi.
- selected_meeting kuponlarında resultCsvUrl yoktu; resmî program kaynağından hostname+normalizeşehir eşleşmesiyle tüm officialVerified/missingURL kayıtlara kaynak metadata eklenir. Önce sadece simulation için olan kaynak kurtarma genişletildi. Eski kuponlar/seçimler/createdAt değişmez; resmi sonuçlar mevcut parser ile doğrulanır.
- Simülasyon v2 seçim amacı iki kupondan en az birinin model kapsamı. Önceki toplam-marginalhedef, ortakayak bağımlılığını yok sayıyordu. Yeni coupon-pair-coverage aynı yarış ortak atlarının snapshotnormalized probability kesişiminden jointcoverage hesaplar; model/snapshotdağılımı eksik/çelişkiliyse conservative overlap bound. Bağımsız farklıyarış varsayımı ve calibrated:false açık. İlk gün immutable v1 kuponları yeniden seçilmedi. Yeni model başarı oranı iddiası yok.
- Yeni15ortak-kapsam/simülasyon/şehir-kupon/cache testi geçti. Kaynak açıklıkları USfitidman0.4%,kendisüre20.2%,soy12.2%,hava0;TRsoy17.7%,ikramiye41.9%,geçmişsınıf53.3%. Tekrar tutulan test üzerinde eşik ayarı/eğitim yapılmadı.

## 20 Ekim 23:18 — güvenilirlik geliştirme programı başladı
- Kullanıcı önceki planı sırayla uygulayıp bağımsız kanıt oluşana kadar sürdürmeyi istedi; çalışma hedefi active. Başarı garantisi/sonuç yüzdesi sözü yok. Plan data/maintenance/reliability-program.json.
- training-contract.mjs atadı-normalizasyonu/duplicate race/runner alignment/feature schema+finite/positive outcome denetimi, 2test geçti. MorningTR12421/US10913girdi denetimi passed. Kaynak provenance veya prestart availability denetimi yerine geçmez. Yeni eğitimde export sonrası fitting öncesi tüm ülkeler için failclosed kontrol bağlandı; mevcut frozen girdiler ve modeller değişmedi.
- daily.lock4204 gerçek süreç hâlen canlı; sandbox dışı GetProcess doğruladı. Bakımı kesme/çift toplama/eğitim başlatma. UScareercharts20:16Z tamam, yeni0,29PDF404; aynı pencere tekrar taranmadı. RollingUSidman21335 kayıt; bu turun katkısı diye sunulmaz.
- Sonraki adım mevcut ABD chartlarından gerçek kullanılabilir önceki derece/sınıf/tempo kapsamını ölçmek; winner time bireysel at süresi yapılmaz. Sonra izinli tarihsel veri kazanımı ve önceden tanımlı doğrulama deneyi.

## 20 Ekim — ABD çizelge kullanım denetimi ve deney hazırlığı
- audit-us-chart-utilization.mjs morning frozen kaynak6725race49165runner:48909Fin,49102earlyCall,19334eğitimrunner priorchart; frozenexternalstartsKnown19334, aktarımkaybıörneği0. WinnerTime/fractions tümchartta var, bireyselatderecesi değildir. Denetim source normalization politikasını kullanır; tamkariyer/registry kimliği iddiası yok.
- prior-race-context.mjs deneysel5feature: önceki yarış kazananının hız bağlamı/sayı/son tarih/missing. Kaynak resmîöncekigün, bilinenmesafe+geçerlisüre, tekrarchartdedup, USonly; atınbireyselsüresi/sektionali türetilmez. 3context+pace testi geçti. Aktifmodele ve canlıtahmine bağlanmadı.
- Deney önkaydı data/maintenance/experiment-us-prior-race-context-v1.json; kontrol donmuş parent/aynıparametreler, seçim eski kronolojikvalidation, doğrulama yeni prospective+mevcutkapılar. Modelbaşarıartışı ölçülmedi. Featureartifact morning/US/prior-race-context-v1.json,sourceSHA sabit; orijinal eğitim ve modeldosyaları korunuyor.
- Günlükbakım4204 canlı, ikinci veri/eğitim işi başlatılmadı. Sonraki: bu deneyin exporter/runtime eşitliğini versioned flag ile kurup kontrol parametreli validation denemesi; tekrarkullanılmış test ile ayar yapma.

## 20 Ekim — bağlam kontrol deneyi sıraya alındı
- prepare-context-validation.mjs frozenUS feature sidecar üretir; chartsSHA+trainingSHA ve horsesarray ile bütünlük bağlı. validate-prior-race-context.py yalnız parenttrain.from..validation.from öncesi5121koşu ile fit, eskivalidation708koşu ile kontrol/context karşılaştırır. Parentın aynı186tree/depth4/.045/l2=3 ve temperature0.766661329 kullanılır; featureselection/temperature önce aynıvalidationda seçilmiş olduğu için reused_validation_diagnostic_only, bağımsızkanıt değildir. TestScoredfalse, activeChangedfalse. Preflight hash/kimlik/boyut+finitedenetimi passed.
- run-context-validation.mjs ortak intelligence-training.lock +dailyowner korur; bekleyen gerçekpid11956, terminalsession94856. Çıktı data/experiments/us-prior-race-context-v1/state.json/logdata/maintenance/context-validation-2026-10-20.log. Bakım4204 canlı doğrulandı, fit henüz başlamadı. Beklemeyi hata sanıp ikinci iş açma. Bittiyse validation-report.json oku, sonra verify-context-validation.mjs <out> çalıştır; scoringparity fullservingfeatureparity değildir.
- Deney faydalı görünürse sonraki gerçekadım servingpipeline yenişeması+tam runtimefeatureparity ve prospective bağımsızkayıt; aday doğrulama tekbaşına terfi değildir. Deney başarısızsa aynıtest üzerinde eşik araması yapma. Aktifmodel/kupongeçmişi değişmedi.

## 20 Ekim — bağlam sürümü ihracı ve geriye uyumluluk
- Yeni intelligence_context_v1/pipelineRevision5 yalnızUS, priorRaceContextSchemaVersion1+intelligenceSchemaVersion2+frozenparent method/parameters ile policy tarafından kabul edilir. Mevcut metadata/aktifpointer değişmedi. Export OFFICIAL_RACE_CONTEXT_FEATURES1 açık seçilirse sonuna5özellik; ranking/verify aynı priorRaceContext fonksiyonunu kullanır. Eski modellerin feature yolu korunur.
- İzoleSQLite+morning frozen archive/workout/pedigree/prize/charts ile tamUSexport üretildi. verify-context-export.mjs10913koşu81677runner: eski217özellik+at/etiket/baseline sırası tamaynı, yeni5özellik sidecar ile tamaynı. fullExportReconstructionParitytrue; fullServingPipelineParity hâlâfalse (tam canlıyenidenkurulum ayrıca doğrulanmalı).
- Yeni policy/context/pace/performance6test geçti, değiştirilenscriptlerin syntax kontrolü geçti. Konteks eğitimi11956 hâlen waiting_maintenance; bakım4204 ve çocuk20136 canlı doğrulandı. session94856 yeniden açılmadı. Deney fitsonucu yok, başarıartışı iddiası yok. Sonraki tur gerçekiş durumunu doğrula, tamamlandıysa Python/Node skorparitesi ve validationmetrics; sonra tamservingfeatureparity. Bakımı kesme.

## 20 Ekim — bağlam tam serving özellik eşitliği doğrulandı
- ranking.mjs özellikhesap bloğu değiştirilmeden localRankingFeatureVectors içine taşındı; rankRaceLocally aynı fonksiyonu çağırır. verify-context-serving.mjs frozenarchive+workouts+pedigree+prize+charts ile günlükgeçmişi sırayla kurar, hedef gün sonuçlarını geçmişe ancak tümgün hesaplandıktan sonra ekler.
- Gerçek servingbuilder 10913USkoşu81677runner222feature tam eğitim ihracıyla eşleşti. data/experiments/us-prior-race-context-v1/serving-feature-verification.json fullServingFeatureParitytrue,scoreParityVerifiedfalse,activeChangedfalse. Henüz yeni model fit/skorparitesi veya bağımsız başarı kanıtı değil.
- Eski fonksiyon yedeği .migration/ranking-before-feature-builder.mjs ile27tarih/modelvaryantı rankRaceLocally JSON çıktısı aynı. QA raporu feature-builder-refactor-verification.json; tarihkoruması yalnız QA içinoverride, forecast/başarı verisi oluşturulmadı. Tekseferlik QA script silindi; kullanıcıverisi silinmedi.
- Deney11956/state waiting_maintenance, bakım4204 gerçekcanlı doğrulandı. Aynıdeney tekrar başlatılmadı. Sonraki tur kontrollü eğitim tamamlanınca validationmetrics ve verify-context-validation.mjs skorparitesi; fayda yoksa bu adayı aktif etme. Aktifmodel/eskikuponlar korunuyor.

## 20 Ekim — gerçek prestart olasılık kalite denetimi
- probability-quality.mjs +audit-probability-quality.mjs mevcut881dosya716MB arşivi okur; yalnız modelmetadata/trainedThrough<raceDate/capture<start kabul. Yarışbaşına ensonservingsnapshot, tamstarter+sonuçadıeşleşmesi, resmîDNF bilinenkayıp, deadheat kredi paylaşımı. Öncedenyayımlanmış AGF yalnız capturedAt<=modelCapture ve <start, aynıfield ise karşılaştırılır. Sonuçeksik51/kimlikfield45 dışarıda; uydurma/sonradanlabel yok.
- 596eligible snapshot,500sonuçlu yarış13gün: ilkatan30.8%. Aynı414field model32.1256 vsAGF35.5072;Brier.796422 vs.767790,logloss1.825697 vs1.751278. Gözlenen fark AGFlehine; bağımsız/istatistikselüstünlük veya yeni kalibrasyon iddiası değil. TR190race33.16/AGF36.84;US224paired31.25/34.375. MixedtümUS310race29.35. Rapor data/maintenance/probability-quality-2026-10-20.json.
- İlkimplementasyon tümarşivi bellektetutuyordu; yalnız uniquevalidraces sonkayıt tutulacak biçimde sınırlandı; yenidenkoşu6sn. Sabit10binpürdescriptive, eşik/temperature fit edilmez. 3test geçti; gerçekDNF/eksikfield/ölüısı/sonradanAGF/differentmodelversion dedup kapsanır. Morning probability_quality aşaması eklendi.
- Bakım4204 canlı, çocuk4028adımı ilerledi; kontrol11956bekliyor. Bakım hata sanılmadı, durdurulmadı, çift eğitim yok. Yeni deney sonu hâlâ okunmalı; başarı artışı kanıtlanmadı.

## 20 Ekim — bakım arşiv belleği ve yeni veri
- daily-maintenance.mjs yalnız son tarih için listHistoricalRaces ile bütünarşivi scopeboyuncatutuyordu; son tarih historicalRaceDates ilealınır. Ülke yeni-veri/count kararları maintenanceArchiveSummary SQLtoplusayımına geçirildi, historicalMaintenanceSummary DBwrapper. Öğrenme/promotionkapıları değişmez; canlıbakım durdurulmadı, sonrakiçalışmadaetkili.
- 3summary/contract testi geçti. GerçekDB saltokunurquery TR12421/newer252,US11160/newer368;foreign JSONtype missing5944/false6477/true23195, mevcutgerçekveri ile falsysemantikuyumlu. Üçtoplusorgu43.56sn; bellek nesnesi azaltma, ölçülmüş süre kazancı iddiası yok. CanlısourcearchiveJSON sayısı exportresolvedraces sayısıyla aynıolmak zorunda değil.
- Bakım20:43:39Z PRIZEtrain40meetingbatch331kayıt ekledi:TR174/US157,13962→14293. Philadelphia17MarNoPrizeParsed1hata; eksikoluşturulmadı. Raporhistorical-collection-report.json/reliability-new-prizes-2026-10-20.json. Öncekidonmuşdatasetveaktifmodelde değişiklik yok; başarıartışı ölçülmedi.
- Bakımphase exporting_US'a geçti, çocuk20828; bekleyencontrol11956 waiting_maintenance. Gerçekilerlemeyi kilitmetninden değil süreç+yeniraporla doğruladık. Sonraki aynıişleri poll et; ikinci eğitim başlatma.
