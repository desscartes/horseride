# Ev sunucusu

Canlı proje: `192.168.1.15`, `D:\Apps\HorseRide`. Windows 11 Pro, i5-8300H, 16 GB RAM. Sanallaştırma kapalı olduğu için Docker yerine doğrudan Windows kurulumu kullanılıyor.

`GanyanZekasi-Service` görevi SYSTEM hesabıyla bilgisayar açılışında başlar; kullanıcı oturumu gerekmez. Node: `D:\Tools\node-v24.15.0-win-x64\node.exe`. Eğitim Python'u: `D:\Apps\HorseRide\.venv\Scripts\python.exe`. Günlük toplama/eğitim ve 20 dakikalık yarış öncesi kayıtlar servis gözetmenindedir. Eksik bakım 6 saat sonra tekrar denenir. Eğitim iki CPU iş parçacığı kullanır; terfi koşulları değişmedi. Prizde otomatik uyku ve hazırda bekleme kapalıdır; Windows yeniden başlatmalarında görevler tekrar çalışır. Fiziksel yeniden başlatma henüz test edilmedi.

API: ev ağı içinde `http://192.168.1.15:8788`. `GanyanZekasi-PublicGateway` yalnızca `127.0.0.1:8790` üzerinde derlenmiş arayüzü ve sınırlı API erişimini sunar. Dışarıdan analiz POST istekleri sadece hazır sonucu okuyan GET isteğine dönüşür; eğitim, geri test ve yönetim uçları dışarı açık değildir.

`GanyanZekasi-TestTunnel` geçici Cloudflare HTTPS erişimidir. Adres `data/maintenance/public-tunnel.log` içindedir; süreç yeniden başlayınca değişebilir. Kalıcı üretim yayını değildir. Alan adı ve yönetilen tünel kurulduğunda aynı giriş servisi kullanılabilir. Modemde port yönlendirme yapılmadı.

Yerel `D:\Game_Project\HorseRide` geliştirme kopyasıdır. `data/maintenance/remote-server.json` işareti yerel gözetmenin tekrar başlamasını engeller. Çalışan eski gözetmeni kapatmak için yerel yönetici PowerShell'de `server/disable-local-service.ps1` çalıştırılır. Bu işareti canlı sunucuya kopyalamayın.

Kaynak dağıtımı ile `data/` ve `.env` aktarımı ayrıdır. SQLite aktarımı çevrimiçi backup API ile alınmış ve quick_check ile doğrulanmıştır; diğer dosyalar SHA-256 manifestiyle doğrulanmıştır. Kaynak Git geçmişi taşınmak üzere bundle olarak korunmuştur. SSH özel anahtarı, `.env`, veritabanı ve model arşivi Git'e eklenmez. Yerelde tamamlanan değişiklikler test edilip commit/push yapılır; sunucuya kaynak güncellemesi veri klasörünün üzerine yazmadan uygulanır.
