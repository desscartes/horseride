# Sürümlenen canlı arayüz başlangıcı

`bootstrap/`, canlı uygulamanın gözden geçirilmiş eski arayüz tabanıdır. Bu tabanın kaynak JSX sürümü checkout içindeki `src/main.jsx` ile tam eşleşmediğinden, güncel kupon ekranı `server/build-coupon-ui-patch.mjs` ile bu taban üzerine üretilir.

`npm run build:production-ui`, boş bir checkout'ta `dist/` klasörünü buradan oluşturur ve güncel kupon fonksiyonlarını uygular. Böylece Git dışında tutulan `.migration/` yedeği üretim için zorunlu değildir. Taban SHA256 öneki `base-entry.json` ile doğrulanır; bilinmeyen mevcut üretim giriş dosyası sessizce ezilmez.

`npm run build` deneysel/eski JSX arayüzünü üretir; canlı dağıtım veya APK hazırlığı için kullanılmamalıdır. Bu geçiş yapısı ileride tabanın bütün ekranları kaynak JSX'e taşındığında kaldırılabilir. Veri, model, anahtar ve APK içermez.
