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
