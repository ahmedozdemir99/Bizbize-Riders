# Google AI Studio yayını için PWA + Web Push kurulumu

Bu sürüm; gerçek PushManager aboneliği, Supabase Edge Function göndericisi,
veritabanı tetikleyicisi, kalıcı gönderim kuyruğu ve Service Worker içerir.
**Kodun GitHub'a aktarılması bunları Supabase'de kendiliğinden etkinleştirmez.**
Aşağıdaki kurulum yapılmadan telefonda “etkin” abonelik gösterilmez.

## 1. Yayımlanmış uygulama adresi

AI Studio'dan uygulamayı HTTPS ile yayımlayın. Önizleme/sohbet paylaşım ekranını veya
iframe içindeki önizlemeyi kullanmayın. İki telefonda aynı kalıcı uygulama adresini açın.
Bu adresin origin'ini not edin: örneğin `https://uygulama.example.com` (sonunda `/` yok).

## 2. Bildirim anahtarları

Projede:

```sh
npm ci
npm run push:keys
```

Bu komut **gizli** `.env.push.local` dosyasını oluşturur; var olan anahtarları ezmez.
Dosyada `APP_ORIGIN` değerini yayımlanmış origin, `VAPID_SUBJECT` değerini
`mailto:email-adresiniz` yapın. Anahtarları veya bu dosyayı sohbete/GitHub'a göndermeyin.
VAPID anahtarlarını değiştirmek tüm telefonlarda yeniden abonelik gerektirir.

## 3. Supabase kurulumu

Önce mevcut temel uygulama tabloları oluşturulmuş olmalı.

1. Authentication → Providers bölümünden **Anonymous Sign-Ins** özelliğini açın.
   Kimlik şifresiz oluşturulur; bildirim uç noktaları yalnızca doğrulanmış kimliğe bağlanır.
2. SQL Editor'da `supabase/migrations/202611110001_web_push.sql` dosyasını çalıştırın.
   Bu, özel abonelik/gönderim tablolarını, kimliği doğrulayan tetikleyicileri,
   pg_net ve 10 saniyelik cron tekrar denemesini kurar. Yeniden çalıştırılabilir.
3. Yerel terminalden Supabase CLI ile giriş yapıp fonksiyonu ve sırları yükleyin:

```sh
npx supabase login
npx supabase secrets set --project-ref YOUR_PROJECT_REF --env-file .env.push.local
npx supabase functions deploy push --project-ref YOUR_PROJECT_REF
node scripts/push-vault.mjs --project-ref YOUR_PROJECT_REF
```

4. Oluşan **gizli** `.push-vault.local.sql` dosyasını SQL Editor'da çalıştırın.
   Cron'un fonksiyona erişmesi için aynı worker sırrını Vault'a kaydeder.

`YOUR_PROJECT_REF` Supabase proje adresinizin ilk bölümüdür. `.env.push.local`,
`.push-vault.local.sql`, service-role ve VAPID özel anahtarı frontend'e/`VITE_`
değişkenlerine konulmaz. Edge Function'ın JWT kontrolü handler içinde yapılır:
abonelik işlemleri doğrulanmış kullanıcı, gönderim worker'ı ayrı gizli anahtar ister.

pg_cron'un `10 seconds` desteği güncel Supabase PostgreSQL/pg_cron sürümü gerektirir.
SQL hata verirse kurulumu tamamlanmış saymayın; cron/pg_net desteklerini panelden kontrol edin.

## 4. Her iki telefonda bildirimleri açın

- Android: yayımlanan sayfayı Chrome'da açın; ana ekrana yüklemek önerilir.
- iPhone: iOS 16.4+ gerekir. Safari → Paylaş → Ana Ekrana Ekle; ardından uygulamayı
  o simgeden açın. Yalnızca normal bir tarayıcı sekmesi yeterli değildir.
- Menü → **Bildirim Ayarları** → **Bildirimleri aç**; sistem iznini onaylayın.
- İlk etkinleştirmede eski `rider_...` ID yerine Supabase'in doğruladığı yeni bir
  sürücü ID'si kullanılır. **İki telefonda da etkinleştirip Profil Ayarları'ndaki
  yeni ID'lerle birbirinizi yeniden ekleyin.** Yerel geçmiş korunur, kendinize ait
  eski mesajlar tanınmaya devam eder; eski kişiye gönderilen mesajlar yeni ID'ye yönlendirilmez.
- Şifresiz kimlik cihazın tarayıcı verilerinde saklanır. Site verisini silmek bu
  kimliği de kaybettirir; bu bir e-posta/şifre hesabı veya cihazlar arası hesap kurtarma sistemi değildir.
- Kortej bildirimleri varsayılan kapalıdır; isterseniz ayarlardan açın.
- “Test bildirimi gönder” ile test edin. “İletildi” sağlayıcının kabulünü belirtir;
  ekranı kilitleyip gerçek telefonda görünmesini ayrıca kontrol edin.

Anonim/eski ID ile doğrulanmamış göndericiler push kuyruğu oluşturamaz. Sadece alıcının
aboneliğini açmak yetmez; gönderen de bu yeni doğrulanmış kimlikle işlem yapmalıdır.

## Nasıl çalışır?

Mesaj/arama kayıtları veritabanına başarıyla yazılınca tetikleyici doğrulanmış JWT'nin
kimliğini kontrol eder ve özel kuyruğa iş ekler. pg_net hemen fonksiyonu çağırır;
bağlantı hatalarında cron tekrar dener. Gönderenin tarayıcısının açık kalması gerekmez.

- Birebir mesaj/arama yalnızca alıcının özel aboneliklerine gider.
- Kortej mesaj/araması yalnızca o korteji bildirim tercihlerinde seçenlere gider.
- Kilit ekranına mesaj içeriği konulmaz; varsayılan metin “Yeni mesajınız var.”dır.
- Bildirimler gerçek VAPID imzası ve Web Push şifrelemesiyle gönderilir.
- Başarılı teslimatlar tekrar gönderilmez; 404/410 dönen abonelikler silinir;
  geçici hatalar sınırlı tekrar denemeye alınır. Sağlayıcı kabulü telefon teslimat garantisi değildir.
- Gelen arama daveti 45 saniyelik TTL kullanır. Geç/ters sırada gelen olaylar eski
  aramayı yeniden çaldıramaz. Bitmiş/kaçırılmış arama bildirimi aynı etiketle sessizce
  güncellenir; görünmez push kullanılıp iOS'un kullanıcıya görünür bildirim kuralı ihlal edilmez.
- Bildirime dokunmak ilgili kabul/katıl ekranını açar; mikrofonu kendiliğinden açmaz.
- Tarayıcı aboneliği yenilenirse uygulama açıkken yenileme uyarısı gösterilir;
  Bildirim Ayarları'ndan tekrar açın. Site verisi silinmesi veya izin kaldırılması
  sonrasında otomatik teslimat varsayılmaz.

## Sınırlar

PWA kilit ekranında telefon araması gibi kendiliğinden tam ekran açamaz. İnternet,
bildirim izinleri, iOS/Android odak/pil ayarları ve push sağlayıcısı teslimatı etkiler.
Fiziksel Android ve iPhone'da açık, arka planda ve kilitli durumları test etmeden
“kilit ekranında doğrulandı” denmez. WebRTC için farklı ağlarda TURN hâlâ gerekir.

Bu migration bildirim sırlarını ve kuyruğunu korur; mevcut uygulamanın eski anonim
mesaj/arama okuma-yazma politikalarını tamamen değiştirmez. Veritabanı düzeyinde özel
mesaj gizliliği için ayrıca tam Auth/RLS geçişi gerekir. Servis rolü hiçbir zaman istemciye verilmez.

## Kontroller

```sh
npm run test:push
npm run test:notifications
npm run lint
npm run build
```

Testler gateway kimliğini, CORS/SSRF korumasını, gerçek PostgreSQL tetikleyicilerini,
çift worker kilidini, tekrar denemeyi, şifrelenmiş gönderimi ve tarayıcı abonelik akışını
kontrol eder. Canlı Supabase projesine veya gerçek telefonlara test bildirimi göndermez.

## Telefonda Supabase editörüyle fonksiyon yükleme

`npm run push:editor` kaynak dosyaları tek bir editör dosyasına toplar.
Supabase → Edge Functions → yeni fonksiyon editöründe `index.ts` içeriğini tamamen
silip `supabase/functions/push/editor-bundle.ts` dosyasının tamamını yapıştırın.
Fonksiyon adı **push** olmalı. Dağıtımdan sonra fonksiyon ayarlarında platformun
**Verify JWT / legacy JWT verification** kontrolünü kapatın; kod abonelik JWT'sini
ve worker sırrını kendisi doğrular. Aksi halde anahtarla çağrılan cron worker'ı
platform tarafından reddedilir. Ardından bu rehberdeki Secrets ve Vault kurulumunu
tamamlayın. Anahtarlar kurulmadan fonksiyonun `push_not_configured` yanıtı vermesi beklenir.

### Editörde `rapid-task` adıyla oluşturulduysa

Name alanını değiştirmek fonksiyonun URL slug'ını değiştirmez. Uygulama `push`
adresi bulunamazsa aynı projenin `rapid-task` adresini dener. Vault kurulumunu bu
gerçek endpoint'e yönlendirmek için:

```sh
node scripts/push-vault.mjs --project-ref YOUR_PROJECT_REF --function-name rapid-task
```
