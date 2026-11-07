# AI Map Planner

Gemini ile gezi önerileri oluşturan, yerleri Google Maps'te gösteren ve günlük planı PDF olarak dışa aktaran web uygulaması.

## Gereksinimler

- Node.js 20.6 veya üzeri
- Gemini API anahtarı
- Google Maps JavaScript API anahtarı (HTTP referrer ve gerekli API'lerle kısıtlanmış)

## Kurulum

```bash
npm install
```

`.env.example` dosyasını `.env.local` adıyla kopyalayın ve anahtarları girin:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

`.env.local` Git tarafından yok sayılır. Ardından geliştirme sunucusunu başlatın:

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Vite geliştirme sunucusu ve Gemini API sunucusu |
| `npm run build` | İstemci dosyalarını `dist/` içine derler |
| `npm start` | Derlenmiş uygulamayı ve API'yi Node.js üzerinden sunar |

Üretim ortamında `GEMINI_API_KEY` değerini barındırma sağlayıcısının sunucu ortam değişkeni olarak tanımlayın, `VITE_GOOGLE_MAPS_API_KEY` değerini de derleme sırasında sağlayın. Uygulama statik dosya barındırma ile tek başına çalışmaz; `/api/plan` için Node sunucusu çalışmalıdır.

## Güvenlik

Gemini anahtarı yalnızca Node sunucusunda okunur ve tarayıcı JavaScript'ine gömülmez. API uç noktası istek başına boyut sınırı ve basit IP hız sınırı uygular. Herkese açık üretim trafiğinde barındırma katmanında ek kötüye kullanım koruması ve izleme yapılandırın.

Google Maps anahtarı tarayıcıda kullanıldığı için gizli değildir. Google Cloud Console'da web sitesi referrer'ları ve yalnızca gereken API'lerle kısıtlayın. Daha önce kaynak koda yazılmış anahtarı yenileyin veya kısıtlayın.

## Lisans ve varlıklar

Kaynak dosyalarda Apache-2.0 bildirimi bulunuyor. Depoyu yayımlamadan önce `logo.png` ve diğer görsellerin kullanım haklarını doğrulayın; bu proje için genel bir `LICENSE` dosyası ekleyecekseniz lisans sahibini ve kapsamını teyit edin.
