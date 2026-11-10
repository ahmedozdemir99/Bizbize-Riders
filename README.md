# BizBize Riders

Motorcu toplulukları için React, TypeScript ve Vite tabanlı iletişim uygulaması.

## Yerel geliştirme

Node.js 22.12 veya üzeri gereklidir.

```sh
npm ci
npm run dev
```

Uygulama http://localhost:3000 adresinde açılır.

```sh
npm run lint
npm run build
```

Bağımlılıklar `package-lock.json` ile sabitlenmiştir; kurulum için npm kullanın.
Supabase bağlantısı giriş ekranındaki veritabanı ayarlarından düzenlenebilir.
Sunucu bağlantısı olmadan mesajlar yalnızca bu tarayıcıda saklanır.
Cihazlar arası mesajlaşma ve aramalar Supabase kurulumu gerektirir.

## Logo

`public/logo.svg` giriş ekranı, üst çubuk ve tarayıcı sekmesinde kullanılır.
Ortak React bileşeni: `src/components/BrandLogo.tsx`.

## Aramalar ve mesajlar

Aramalar `calls`, `call_signals`, `group_calls`, `group_call_members` ve
`group_call_signals` tablolarını kullanır. Eksik tablolar için uygulamadaki
veritabanı ayarlarında bulunan Supabase SQL şemasını çalıştırın.

WebRTC teklifleri ve ICE adayları hem Realtime üzerinden hem de veritabanından
okunur. Böylece kullanıcı mikrofon izni verirken gelen adaylar kaybolmaz.
Gelen medyada otomatik oynatma engellenirse **Sesi ve görüntüyü aç** düğmesine dokunun.

Farklı mobil operatörlerde veya kısıtlı ağlarda yalnızca STUN yeterli olmayabilir.
Dağıtım ortamında `.env.example` içindeki `VITE_TURN_URLS`, `VITE_TURN_USERNAME`
ve `VITE_TURN_CREDENTIAL` değerlerini TURN sağlayıcınızın bilgileriyle tanımlayıp
uygulamayı yeniden derleyin. TCP/TLS destekli bir TURN hizmeti önerilir.
Bu repoya bir TURN hizmeti veya gerçek erişim bilgisi eklenmemiştir.

Mesajlar önce cihazda saklanır. Eski sorgu yanıtları yeni mesajları veya başka
sohbetin ekranını değiştiremez; sunucudan alınan geçmiş de cihazda önbelleğe alınır.
Gönderim başarısız olduğunda kullanıcıya haber verilir. Çevrimdışı yazılan mesajlar
cihazda kalır; otomatik yeniden gönderim yapılmaz.

## İletişim regresyon testi

Önce `npm run dev` çalıştırın. Başka bir terminalde:

```sh
npx playwright install chromium
npm run test:communication
```

Sistem Chromium'u için `CHROMIUM_PATH=/usr/bin/chromium` ayarlanabilir.
Farklı portta çalışan uygulama için `TEST_URL=http://localhost:3001` kullanın.
Testler Supabase REST yanıtlarını yerel bellekte taklit eder; gerçek veritabanına
veri göndermez. WebSocket kapalıyken iki ayrı kullanıcı oturumunda gerçek WebRTC
RTP paketlerini, medya oynatmayı, arama sonlandırmayı ve mesaj kalıcılığını denetler.
Tarayıcı politikası doğrudan WebRTC trafiğini engelliyorsa geliştirme sunucusunu
bir test TURN sunucusunun `VITE_TURN_*` değerleriyle başlatın.
