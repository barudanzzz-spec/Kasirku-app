# ZERO STORE Android — Complete Starter

Aplikasi marketplace akun game menggunakan Expo React Native + Supabase.

## Fitur di source
- Daftar/login email dan password
- Login Google via Supabase OAuth (perlu konfigurasi provider dan deep link)
- Katalog, kategori, pencarian, detail produk
- Keranjang (checkout saat ini satu item per order)
- Checkout QRIS statis dan unggah bukti pembayaran
- Riwayat pesanan
- Profil
- Dashboard admin: CRUD produk, upload gambar, verifikasi status pembayaran

## Instalasi di komputer
1. Install Node.js LTS.
2. Ekstrak ZIP.
3. Jalankan:
   ```bash
   npm install
   ```
4. Salin `.env.example` menjadi `.env` dan isi variabel.
5. Jalankan:
   ```bash
   npx expo start
   ```
6. Buka Expo Go Android dan scan QR.

## Dependensi tambahan
Jalankan `npx expo install expo-image-picker` setelah `npm install` jika belum terpasang.

## Supabase
1. Buat project Supabase.
2. SQL Editor > jalankan `supabase/schema.sql`.
3. Isi URL dan anon/publishable key ke `.env`.
4. Authentication > Providers > aktifkan Email dan Google.
5. Konfigurasikan OAuth Google Client ID/Secret dan callback URL sesuai yang ditampilkan Supabase.
6. Buat akun admin lewat signup, ambil UUID dari Authentication > Users, lalu:
   ```sql
   update public.profiles set role = 'admin' where id = 'UUID_ADMIN';
   ```
7. QRIS merchant di-host sebagai gambar yang dapat diakses publik; isi URL-nya pada `EXPO_PUBLIC_QRIS_IMAGE_URL`.
8. Isi nomor admin dengan format internasional pada `EXPO_PUBLIC_ADMIN_WHATSAPP` jika nanti ditambahkan tombol kontak.

## Build APK
Untuk build Android gunakan EAS:
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```
Ikuti instruksi EAS. Build APK membutuhkan konfigurasi dan akun Expo.

## Penting sebelum dipakai transaksi nyata
- QRIS pada starter ini statis. Tidak ada pengecekan pembayaran otomatis; admin memverifikasi bukti secara manual.
- Belum ada payment gateway, webhook, escrow, refund, dispute center, notifikasi push, atau multi-item checkout.
- Tambahkan validasi harga di sisi server sebelum produksi; jangan mempercayai nominal dari aplikasi client.
- Jangan pernah menaruh Supabase `service_role` key di aplikasi.
- Pastikan penjualan akun diizinkan aturan game/platform, kepemilikan akun terbukti, dan ada prosedur sengketa/pengembalian dana.
- Uji RLS dan alur pembayaran dengan akun customer dan admin berbeda sebelum membuka ke publik.
