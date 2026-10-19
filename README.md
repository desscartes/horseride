# Ganyan Zekası / HorseRide

Türkiye ve TJK programında yer alan yabancı yarışlar için veri toplama, yerel sayısal modeller, kanıta dayalı Türkçe yorumlar ve bütçeli kuponlar.

## Güncel çalışma akışı

Node24 ve bağımlılıklar için `npm ci` kullanılır. `.env.example` dosyası yerel `.env` olarak yapılandırılır. Yerel yorum üretimi için Ollama ve belirtilen Qwen modelinin ayrıca hazır olması gerekir. API `npm run api` ile, geliştirme arayüzü `npm run dev` ile açılır. Mevcut ev sunucusunda API8788, telefon/web geçidi8790 portunu kullanır. Servis ve bakım ayrıntıları `OTOMATIK-SERVIS.md`, `docs/home-server.md` ve `DEVIR_NOTU.md` içindedir.

Sayısal sıralamayı CatBoost modelleri üretir; yerel Qwen açıklama için kullanılır. `.env.example` yerel sağlayıcıyı seçer; ücretli servis anahtarı boş bırakılır. Ücretli sağlayıcıya geçiş ayrı bir yapılandırma kararıdır.

## Canlı arayüz ve Android

Bu checkout'taki JSX kaynak sürümü canlı ekranın tamamını henüz içermiyor. Canlı kupon ekranını kaybetmemek için:

```powershell
npm run build:production-ui
npm run android:build:local
```

Sürümlenen `production-ui/bootstrap` tabanı, kupon yamalarıyla birlikte boş checkout'ta yeniden üretilebilir. Eski `npm run build` / `android:sync` zinciri canlı dağıtım için kullanılmaz; `android:sync` bu nedenle açıklayıcı hata verir. Android betiği yerel Java/SDK/Gradle araçlarını, mevcut özel imza anahtarını ve doğru sürüm kodunu gerektirir. İmza anahtarı Git'te tutulmaz. Son yayımlanan ayrı uygulama kimliği `com.horseride.local`, sürümü1.34/kodu35'tir; yeni dağıtımda sürüm artırılır. Ayrıntılar `production-ui/README.md` içindedir.

## Veri, modeller ve doğrulama

`server/run-morning-preparation.mjs` sabah akışını, mevcut bakım/eğitim kilitlerini koruyarak çalıştırır. Gün içi program yenilemeleri sonradan yayımlanan toplantıları kapsar. Eksik değer bilinmiyor olarak kalır; ilk start ile eksik geçmiş aynı şey değildir. Gelecekteki sonuç/idman/hava bilgisi hedef yarışa taşınmaz. Resmî kaynak erişim engelleri aşılmaz.

Adaylar kronolojik doğrulama ve test dönemlerinde mevcut modelle karşılaştırılır. Tam Python/JS özellik eşitliği, mevcut21gün/300yarış ve diğer terfi kapıları korunur; yeniden kullanılan testte iyi çıkan aday ayrıca ileri dönem kanıtı gerektirir. Kapsam denetimi, eğitim/test arasında kaynak bulunurluğu farklarını ayrıca raporlar; bu tanısal bilgi test üzerinde tekrar ayar yapmak için kullanılmaz.

Kupon yüzdesi ayaklardaki model kapsamlarının çarpımıdır; kalibre edilmiş kazanma oranı değildir. Hava tahmini bölgeseldir, resmî pist durumu değildir. Kaynak kapsamı ile ölçülmüş tahmin başarısı ayrı raporlanır.

## Git kapsamı

Git kaynak kodu, testleri, belgeleri ve üretilebilir arayüz tabanını içerir. `.env`, SQLite, `data/` model/veri arşivleri, imza anahtarları, yerel SDK/Python ortamları, APK ve `dist/` dışarıda tutulur. Yeni bilgisayarda yalnız Git clone yapmak eğitim verilerini veya etkin modelleri geri getirmez; izinli veri/model yedeği ayrıca gerekir. Anahtar/parola veya ham veri arşivi Git'e eklenmez.
