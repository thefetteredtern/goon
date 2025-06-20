# Goon

**Goon** is a fully local, browser-based app designed for gooners. It randomly selects content from your **favorites** or a **punishment list** to guide your experience. You can use content from Reddit, your own media folders, or a mix of both. Goon includes a metronome, timer, dark/light mode, and it runs entirely in your browser.

> ⚠️ **Currently Windows-only.**
> Cross-platform support may be added in the future based on demand and complexity.

---

## 📦 Download & Install (Recommended)

Download the latest Windows installer from the [**Releases Page**](https://github.com/thefetteredtern/goon/releases/latest).

### 🛠 How to Use the `.exe`:

1. Create a folder (e.g., `C:\Goon`)
2. Place the `.exe` file in that folder
3. Double-click the `.exe` to launch Goon
4. It will open in your default browser at:

```
http://127.0.0.1:5000
```

> 📌 **Do not run the `.exe` from your Downloads folder** the app creates and modifies local files.

---

## 💻 Requirements (Manual / Python Users)

* Python 3.x must be installed
* No external libraries required for basic use
* Reddit API is optional (only needed if you want to enable Reddit-based features)

---

## 🚀 Manual Setup (Python)

### 1. Clone the Repository

```bash
git clone https://github.com/thefetteredtern/goon.git
cd goon
```

### 2. Launch the App

```bash
python app.py
```

Then open your browser to:

```
http://127.0.0.1:5000
```

> ✅ Reddit API is not required if using only local or custom content.

---

## 🔑 Optional: Reddit API Setup

To use Reddit-based content, you’ll need to supply your own Reddit API credentials:

1. Visit [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Click **Create App**, select **script**
3. Save your **Client ID** and **Client Secret**
4. Either enter them in the app’s settings UI or set environment variables:

```bash
REDDIT_CLIENT_ID=your_id
REDDIT_CLIENT_SECRET=your_secret
```

You can switch between **Reddit**, **Custom**, or **Mixed** content modes in-app.

---

## 🔧 Features

* 🎯 **Randomized Content** – Pull from favorites or punishment lists
* ⚙️ **Mode Toggle** – Reddit, Custom, or Mixed
* ⛔ **Punishment System** – Optional behavioral layer
* ⏱ **Session Timer** – Control pacing and breaks
* 🎵 **Metronome** – Optional rhythmic guidance
* 🌓 **Light & Dark Mode** – Pick your vibe
* 🗃️ **Custom Media Support** – Images, GIFs, and videos
* 🌐 **Browser-Based** – No hosting or internet needed
* 🗄️ **Built-In Cache** – Minimizes Reddit API calls by caching recent content locally  
---

## 🧩 Customization

* Organize your own content folders
* Toggle features like punishment, theme, or source in-app
* Fully local and configurable, no cloud, no trackers

---

## ⚠️ Notes

* Goon runs fully offline when Reddit is disabled
* NSFW use is assumed please use responsibly
* Avoid running the app from Downloads; keep it in its own folder
* All settings and content live locally in the same folder as the `.exe`

---

## 🧾 API Usage & Disclaimer

Goon uses the [Reddit API](https://www.reddit.com/dev/api/) *only if you enable it*.

### 🔒 Responsible API Use

* Goon does **not** make background API calls
* All Reddit use is based on **your own credentials**
* API usage is **minimal** (one request per content cycle) and **cached** locally to avoid rate limits  
* No scraping, data storage, or circumvention is involved
* A generic `User-Agent` string is included in each request

This design aims to comply with Reddit’s Terms of Service and ensure fair, transparent usage.

### ⚠️ User Responsibility

If you enable Reddit integration:

> You are responsible for your API credentials and for complying with [Reddit's Developer Terms](https://www.redditinc.com/policies/developer-terms).

Misuse (e.g., excessive requests, abuse of endpoints) can result in your credentials being rate-limited or banned. I am **not responsible** for actions Reddit may take against individual misuse.

---

## 💬 Feedback & Contributions

Goon is an ongoing personal project. Feedback, bug reports, and contributions are always welcome.
