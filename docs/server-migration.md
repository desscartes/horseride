# Sunucuya taşıma

Kaynak kod GitHub deposundadır. `data/` altındaki SQLite arşivi, aktif model ağırlıkları ve eğitim raporları GitHub'a gönderilmez. `.env` de gönderilmez. Yalnızca Git deposunu çekmek mevcut eğitilmiş modeli taşımaz.

Linux sunucuda Node.js 24 ve Python 3.11 veya üzeri gerekir. Kaynak kodu çekin:

```sh
git clone https://github.com/desscartes/horseride.git
cd horseride
npm ci
python3 -m venv .venv
.venv/bin/pip install -r requirements-model.txt
```

Taşınma gününde Windows servis gözetmeni, API ve eğitim işlemleri durdurulduktan sonra `data/` klasörünü özel bir bağlantıyla yeni sunucuya kopyalayın. SQLite ana dosyası ile varsa `-wal` ve `-shm` dosyaları birlikte korunmalıdır; çalışan veritabanının yalnızca ana dosyasını kopyalamayın. Kaynak PC'deki verileri doğrulamadan silmeyin. Yeni sunucuda `.env` oluşturun, `PYTHON_BIN` değişkenini yeni sanal ortamın mutlak Python yoluna ayarlayın. Eski Windows Python yolunun geçersiz olması artık Linux bakımını engellemez.

```sh
PYTHON_BIN=/opt/horseride/.venv/bin/python node --use-system-ca server/service-supervisor.mjs
```

API varsayılan olarak IPv4 `0.0.0.0:8788` adresini dinler. `HOST` ve `PORT` ile değiştirilebilir. Sunucuda kalıcı süreç yöneticisi/systemd kurulması ve HTTPS adresinin hazırlanması ayrıca gerekir. Telefonun **Sunucu bağlantısı** alanına bu HTTPS adresi kaydedilir; adres değişikliği için APK yeniden derlemek gerekmez.

Bu belge hazır bir internet yayını değildir. Dış erişim açılmadan önce HTTPS, erişim kısıtları ve ücretli analiz uçlarının korunması kurulmalı; model/veri aktarımı ve telefon bağlantısı doğrulanmalıdır. Günlük veri/eğitim gözetmeni yerel CatBoost kullanır; OpenAI çağrısı yapmaz.
