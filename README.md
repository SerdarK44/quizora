# ⚡ Quizora | Canlı & İnteraktif Çok Oyunculu Bilgi Yarışması

<div align="center">

![Quizora Banner](public/favicon.svg)

**Gerçek zamanlı, mobil öncelikli, 3D dokunsal arayüzlü ve tam donanımlı yeni nesil bilgi yarışması platformu (Kahoot alternatifi).**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1_SQLite-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Özellikler](#-öne-çıkan-özellikler) • [Kurulum](#-hızlı-kurulum) • [Yönetici Paneli](#-yönetici-paneli-ve-güvenlik) • [Soru Formatları](#-soru-içe-aktarma-formatları) • [Mimari](#-teknoloji-yığını)

</div>

---

## 🌟 Öne Çıkan Özellikler

### 📱 1. Mobil Öncelikli & 3D Dokunsal Tasarım (Mobile-First 3D Tactile UI)
- **Özel 3D Butonlar:** Basılma hissi veren gölgeli ve dokunsal (`btn-3d`) buton fiziği.
- **Canlı Renk ve Şekil Kodlaması:** 
  - 🔺 **Kırmızı Üçgen** (A Seçeneği)
  - 🔷 **Mavi Elmas** (B Seçeneği)
  - 🟡 **Sarı Daire** (C Seçeneği)
  - 🟩 **Yeşil Kare** (D Seçeneği)
- **Sıfır Gecikmeli Ses & Titreşim:** Web Audio API ile sıfır harici dosya bağımlılığıyla çalışan prosedürel ses sentezleyici (tıklama, geri sayım bipleri, alkış/trompet kutlamaları) ve mobil cihazlar için Haptic titreşim desteği.

### ⏱️ 2. Soru Öncesi 3 Saniyelik Canlı Geri Sayım
- Yönetici soruyu başlattığında hem ana ekranda hem de tüm katılımcıların telefonunda eş zamanlı olarak **3 ➔ 2 ➔ 1** geri sayım ve ses efektleri devreye girer.
- Katılımcılar soruya odaklanmaya hazırlanır ve sürpriz açılışlar önlenir.

### 🛠️ 3. Sadeleştirilmiş Yönetici Stüdyosu (Admin Studio)
- **2 Sütunlu Temiz Stüdyo:** Karmaşık sekmelerden arındırılmış, sol tarafta soru akışı filmşeridi, sağ tarafta odaklanmış soru editörü.
- **Sürükle-Bırak Sıralama (Drag-and-Drop):** Soru kartlarını tutarak istediğiniz sıraya kolayca taşıyın veya dokunmatik ekranlar için **↑ Yukarı** ve **↓ Aşağı** oklarını kullanın.
- **Hızlı Parametre Seçicileri:** Tek tıkla süre (10s, 20s, 30s, 60s) ve puan (1.000p, 2.000p, Puansız) belirleme.
- **Görsel Desteği:** Canlı önizlemeli soru görseli URL girişi.
- **Risk Modu:** Doğru cevaba 2× puan, yanlış cevaba -%25 ceza puanı veren rekabetçi risk kuralı.

### 📥 4. Çok Formatlı Soru İçe Aktarma (Excel, CSV, JSON)
- **Desteklenen Formatlar:** `.xlsx`, `.xls`, `.csv`, `.json`.
- **Akıllı Sütun Tespiti:** Türkçe (`Soru`, `Seçenek A-D`, `Doğru Cevap`, `Süre`, `Puan`, `Görsel URL`) veya İngilizce başlıkları otomatik tanır.
- **Esnek Cevap Girişi:** Doğru cevap olarak `A, B, C, D`, `1, 2, 3, 4` veya şıkkın doğrudan metni kabul edilir.
- **Tek Tıkla Şablon İndirme:** Modal içinden hazır **Excel**, **CSV** veya **JSON** şablonunu doğrudan indirin.
- **Önizleme & Ekleme:** Mevcut soruların üzerine ekleme (Append) ya da tümünün yerine koyma (Replace) seçenekleri.

### 📲 5. QR Kod ile Hızlı Katılım
- Yönetici odayı başlattığında ekranda dinamik **QR Kod** ve **6 Haneli Oda PIN** kodu belirir.
- Katılımcılar telefon kamerasıyla QR kodu okutarak PIN girmeden anında odaya katılabilir.

### 🏆 6. 3D Kürsü, İlk 10 Lider Tablosu & Fark Analizi
- **3D Podyum Kutlaması:** Yarışma sonunda ilk 3 oyuncu için podyum animasyonu ve altın konfeti yağmuru.
- **İlk 10 Sıralama Listesi:** Podyumun altında ilk 10 yarışmacının detaylı puan sıralaması.
- **Kişisel Sıralama ve Fark Analizi:** Katılımcı ekranında kaçıncı olduğu ve bir önündeki rakibini geçmesi için kaç puana ihtiyacı olduğu anlık gösterilir.
- **30+ Dinamik ve Eğlenceli Başarı Mesajı:** Turu ve oyunu kazananlar için eğlenceli, özgün tebrik esprileri (`"{user} soruları kahvaltıda yemiş, afiyet olsun! 🥐"`).

### 🎓 7. MathTalk Destek Alanı
- Yarışma tamamlandığında ana ekranda ve katılımcı ekranında MathTalk ekibi tanıtım alanı yer alır.
- **Google Play** ve **App Store** resmi indirme rozetleri ile doğrudan uygulama mağazası bağlantıları.

---

## 🔒 Yönetici Paneli ve Güvenlik

Sistem üst düzey kurumsal güvenlik pratikleri ile donatılmıştır:

- **Varsayılan Giriş Bilgileri:**
  - **Kullanıcı Adı:** `admin`
  - **Şifre:** `SerdarSerdar`
- **Kriptografik Karma (Hashing):** Parola asla düz metin saklanmaz. Web Crypto API ile **PBKDF2-SHA256**, **120.000 iterasyon** ve tuzlama (`quizora-admin-v1`) ile korunmaktadır.
- **Sabit Zamanlı Doğrulama (Timing-Safe Equal):** Zamanlama yan kanal saldırılarına (side-channel timing attacks) karşı korumalıdır.
- **Kaba Kuvvet (Brute-Force) Koruması:** 5 ardışık hatalı denemede IP adresi **1 dakika boyunca otomatik kilitlenir (HTTP 429)**.
- **Güvenli Oturum Çerezleri:** `HttpOnly`, `SameSite=Strict` ve 8 saatlik oturum süresi.
- **Güvenli Çıkış (Logout):** "Çıkış Yap" butonuna basıldığında oturum çerezi sunucuda anında geçersiz kılınır (`Max-Age=0`).
- **Girdi Temizleme (Sanitization):** Katılımcı isimleri zararlı HTML ve kontrol karakterlerinden arındırılır.

---

## 📊 Soru İçe Aktarma Formatları

### Excel (`.xlsx`) / CSV Formatı
Aşağıdaki sütun başlıkları kullanılır:

| Soru | Seçenek A | Seçenek B | Seçenek C | Seçenek D | Doğru Cevap (A/B/C/D) | Süre (sn) | Puan | Görsel URL |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| Türkiye'nin başkenti neresidir? | Ankara | İstanbul | İzmir | Bursa | A | 20 | 1000 | |
| Güneş sistemindeki en büyük gezegen? | Dünya | Satürn | Jüpiter | Mars | C | 20 | 1000 | |

### JSON Formatı
```json
[
  {
    "prompt": "Işık bir saniyede yaklaşık kaç km yol alır?",
    "options": ["30 bin", "300 bin", "3 milyon", "30 milyon"],
    "correctIndex": 1,
    "seconds": 30,
    "points": 1000,
    "imageUrl": ""
  }
]
```

---

## 💻 Teknoloji Yığını

- **Frontend:** [Next.js (Vinext)](https://github.com/cloudflare/vinext), React 19, TypeScript
- **Stil & Arayüz:** Tailwind CSS v4, Lucide Icons, Canvas Confetti
- **Ses & Hissiyat:** HTML5 Web Audio API (Prosedürel Ses Sentezi), Navigator Vibration API
- **Veritabanı & ORM:** Cloudflare D1 (SQLite), Drizzle ORM
- **Dosya İşleme:** SheetJS (`xlsx`)
- **Şifreleme & Güvenlik:** Web Crypto API (PBKDF2-SHA256)

---

## 🚀 Hızlı Kurulum

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/SerdarK44/quizora.git
cd quizora
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```
Uygulama varsayılan olarak `http://localhost:5173` adresinde çalışacaktır.

### 4. Üretim Derlemesi ve Çalıştırma (Production)
```bash
npm run build
npm start
```
Üretim sunucusu `http://127.0.0.1:8787` adresinde yayına başlar.

---

## 🎮 Nasıl Oynanır?

1. **Yönetici Girişi:** Sağ üstteki **"Yönetici Paneli"** butonuna tıklayın ve `admin` / `SerdarSerdar` ile oturum açın.
2. **Yarışma Hazırlama:** Yeni sorular ekleyin, sürükle-bırak ile sıralayın veya **"📥 İçe Aktar"** ile Excel/CSV dosyanızı yükleyin.
3. **Odayı Başlatın:** **"Oda Başlat →"** butonuna basarak canlı lobi ekranını açın.
4. **Katılımcılar:** Projeksiyon ekranındaki veya telefondaki **QR kodu okutarak** ya da PIN koduyla yarışmaya katılın.
5. **Yarışma Akışı:** Yönetici soruyu başlatır (3-2-1 geri sayım), katılımcılar telefonlarından cevaplar, tur lideri esprili mesajla kutlanır ve en son kürsüde şampiyon ilan edilir!

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
