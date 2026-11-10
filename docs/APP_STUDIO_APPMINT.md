# Google AI Studio → Appmint: yayın ve bildirim sınırları

## Bu repoda çalışanlar

- HTTPS sayfasında birebir ve grup WebRTC ses/görüntü görüşmesi.
- Mikrofon/kamera izin hataları, iptal, cevapsız arama ve bağlantı zaman aşımı.
- Ses/kamera kapatma, tekrar açma, otomatik oynatma engeli için kullanıcı düğmesi.
- Uygulama çalışırken tekrarlanan zil ve desteklenen tarayıcıda arama bildirimi.
- Bildirime dokununca doğru arama kabul ekranına dönüş; süresi geçmiş çağrılar açılmaz.
- Service Worker'da çağrı açma/reddetme eylemleri ve sonlanmış çağrı bildirimini kapatma.
- iOS güvenli ekran alanları, MP4/WebM kayıt biçiminin tarayıcıdan alınması, iOS ses oynatma.

## Henüz kurulu olmayanlar

Bu repo bir React web uygulamasıdır; bir Appmint Android/iOS projesi içermez.
FCM/APNs göndericisi, Web Push abonelik sunucusu ve işletim sistemi arama entegrasyonu
bu repoda çalışır durumda değildir. Google AI Studio'da web sayfasını paylaşmak
ve Chrome kısayolu oluşturmak bunları otomatik kurmaz. Realtime bağlantısı da
uygulama arka plana alındığında veya telefon kilitlendiğinde açık kalma garantisi vermez.

Appmint paketini hazırlarken şu entegrasyonlar gerekir:

- Android: Firebase FCM token kaydı/yenilenmesi, kullanıcı bildirimi izni,
  yüksek öncelikli ve kısa ömürlü gerçek çağrı mesajları; arama ekranı için
  platformun izin verdiği yerel Telecom/ConnectionService veya eşdeğer entegrasyon.
- iOS: APNs/FCM yapılandırması, bildirim izni, mikrofon/kamera kullanım açıklamaları,
  gerçek VoIP çağrısı gerekiyorsa Apple gereksinimlerine uygun PushKit/CallKit.
  Sıradan WKWebView sarmalayıcı web bildirimlerini otomatik desteklemez.
- iOS web seçeneği: iOS 16.4+ ana ekrana yüklenmiş web uygulaması, kullanıcı etkileşimiyle
  bildirim izni ve ayrıca gerçek bir Web Push abonelik/gönderim sunucusu gerekir.
- Arama/mesaj eklenince sunucudan bildirim gönderen güvenilir backend gerekir.
  Firebase servis hesabı, APNs anahtarı, Supabase service-role veya VAPID özel anahtarı
  React koduna ya da `VITE_` değişkenlerine konulmaz.
- Push alıcısı yalnızca ilgili çağrı/mesajın yetkili kullanıcısı olmalıdır.
  Mevcut anonim Supabase geliştirme izinleri yerine kullanıcıya bağlı Auth/RLS gerekir.

Kilit ekranında işletim sisteminin tam ekran açması web JavaScript'iyle zorlanamaz.
Appmint'in ilgili yerel eklentileri sunup sunmadığı ve paket ayarları doğrulanmalıdır.
Fiziksel Android ve iPhone üzerinde ekran açık, uygulama arka planda, ekran kilitli
ve uygulama sonlandırılmış durumları ayrı ayrı denenmeden teslimat garantisi verilmez.

## Bildirim sözleşmesi

Gerçek backend, çağrı kaydı başarıyla oluştuktan sonra alıcıya şu veriyi gönderir:

```json
{"type":"call","callId":"call_UUID","title":"Gelen görüntülü arama","body":"Bir sürücü sizi arıyor","expiresAt":1800000045000}
```

`expiresAt` çağrının oluşturulma anından 45 saniye sonrasıdır; sağlayıcının TTL'i de
buna göre ayarlanır. Ret/iptal/cevapsız/bitme durumunda:

```json
{"type":"call-ended","callId":"call_UUID"}
```

Mesaj için kilit ekranında mesaj metnini açığa çıkarmayan varsayılan:

```json
{"type":"message","chatId":"global","title":"BizBize Riders","body":"Yeni mesajınız var"}
```

Service Worker mevcut sekmeye `NOTIFICATION_INTENT` yollar; uygulama kapalıysa
`/?call=call_UUID&action=open` veya `action=reject` ile açar. Kabul eylemi mikrofonu
kendiliğinden açmaz; kullanıcı kabul ekranında seçim yapar. Uygulama çağrının
alıcı kimliğini, durumunu ve süresini veritabanından tekrar doğrular.

## İsteğe bağlı yerel bağdaştırıcı

`window.BizBizeNotifications` **Appmint'in hazır bir API'si değildir**. Yerel paket
entegratörünün uygulayabileceği arayüzdür; uygulama mevcutsa kullanır, yoksa tarayıcıya döner:

```ts
interface NativeNotifications {
  requestPermission(): Promise<'granted' | 'denied'>;
  showIncomingCall(call: {callId: string; callerName: string; video: boolean; expiresAt: number}): Promise<void>;
  dismissCall(callId: string): Promise<void>;
}
```

Yerel bildirim tıklaması uygulamaya şu olayı iletir:

```js
window.dispatchEvent(new CustomEvent('bizbize:notification', {
  detail: {callId: 'call_UUID', action: 'open'} // veya 'reject'
}));
```

## Ağlar

Farklı operatörler veya kurumsal Wi-Fi arasında güvenilir medya aktarımı için
TURN TCP/TLS gerekir. `.env.example` içindeki `VITE_TURN_*` yapılandırması eklenmiştir;
gerçek bir TURN hizmeti bu repoyla sağlanmaz. Paket içinde HTTPS, WebRTC,
`getUserMedia`, otomatik medya oynatma ve arka plan ses yetenekleri etkin olmalıdır.
