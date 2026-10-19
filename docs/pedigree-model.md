# Kan hattı, pist ve zemin denemesi — 10 Ekim 2026

Resmi TJK arşivindeki baba ve anne alanları sayısal eğitim hattına eklendi. 7.773 tamamlanmış Türkiye koşusu, 460 yarış günü ve 75.800 at-yarış kaydı işlendi. Baba ve anne bilgisi bütün kayıtlarda var. Anne babası arşiv sütununda bulunmuyor; bu alan eksik işaretlenir ve uydurulmaz. Mevcut baba-pist özellikleri korunur; yeni 79 özellik sonuna eklenir, eski model indeksleri değişmez.

Baba, anne ve bulunursa anne babası gruplarında genel, kum/çim/sentetik, ±200 m mesafe, bilinen ıslak/kuru zemin ve ±5°C sıcaklık geçmişleri hesaplanır. Başlangıç sayısı, farklı yavru sayısı, temkinli birincilik oranı, alan büyüklüğüne göre bitiriş ve beklenen birincilik sayısına göre başarı farkı kullanılır. Türkiye ve diğer ülkeler ile Arap/İngiliz grupları ayrıdır. Yalnız önceki günlerin son iki yıllık sonuçları kullanılır; atın kendi yarışları aile istatistiklerinden çıkarılır. Yağmur tek başına ıslak zemin anlamına gelmez; tarihsiz veya bilinmeyen zemin kuru sayılmaz.

60.787 kayıtta zemin biliniyor; 68.154 kayıtta aynı pistte en az iki başka baba hattı yavrusu, 53.756 kayıtta aynı pist/zemin için en az iki yavru var. Bu, arşiv kapsamıdır; dünya çapında soy ağacı veya tüm yavruların eksiksiz kariyeri değildir.

Sabit parametrelerle eşleştirilmiş, daha önce incelenmiş 1.003 koşuluk dönem: kan hattı adayının ilk sıra isabeti %26,72, kontrolün %27,92; Brier 0,828060 ve 0,824332. Dolayısıyla bu geniş tarihsel dönemde artış yok. 5–9 Ekim'deki 82 yeni koşuda aday %32,93, mevcut model %30,49; fark +2,44 puan, gün gruplu %95 aralık -2,564…+5,882. İlk üç kapsamı %57,32 ile mevcut modelin %60,98 altında. Bu küçük örnek başarı artışını doğrulamaz. Python ve Node puan farkı 0.

Aday etkin kupon sıralamasına terfi edilmedi. `shadow_pedigree` altında yarış öncesi ayrı kayıtlar biriktirir. Günlük bakımda yeni veriyle tekrar eğitilir; en az 300 koşu/21 gün, +2 puan, pozitif güven aralığı alt sınırı, daha düşük Brier ve düşmeyen ilk üç kapsamı şartları korunur. Eğitim ana sunucuda iki CPU iş parçacığıyla çalışır; ücretli AI çağrısı yapmaz. Arşiv dışa aktarımı bütün ham JSON'ları bellekte tutmak yerine gün gün SQLite üzerinden ilerler.

Çalıştırma: `node --use-system-ca server/run-pedigree-experiment.mjs`. Son deney işaretçisi `data/pedigree-models/latest-TR.json`, rapor ve eğitim verisi ayrı tarihli dizindedir. Canlı model öğrenen sunucudadır; bunun için yeni APK gerekmez.
