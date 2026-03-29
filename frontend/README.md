# LabProcessor 🧪

**LabProcessor** is an AI-powered analytical planning tool designed for Pharmaceutical Quality Control (QC). It automates the extraction of technical parameters from analytical methods (PDFs) and estimates the required man-hours (H/H) for batch release.

## 🚀 Key Features

- **AI Document Analysis**: Uses Google Gemini 2.5 to parse complex analytical methods, monographs, and SOPs.
- **Time Estimation**: Calculates analytical time based on a standardized formula:
  `Total Time = Locomotion + Setup + (Prep + Analysis + Run + Calcs + Register + Incubation)`
- **Microbiology Support**: Specifically handles USP 61/62 requirements, separating active work time from passive incubation lead times.
- **Reagent Extraction**: Automatically lists reagents, concentrations, and estimated quantities.
- **Interactive Dashboards**: Visualizes time distribution via Gantt charts and stacked bar graphs.
- **Multi-language Support**: Full UI and extraction support for Portuguese, Spanish, and English.
- **User Management**: Built-in authentication system with an Admin panel for user administration.
- **Persistent Database**: Saves all processed methods in a local browser database for future reference.

## 🛠️ Tech Stack

- **Frontend**: React 18+, TypeScript, Tailwind CSS
- **AI**: Google Gemini API (@google/genai)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Build Tool**: Vite (Recommended for deployment)

## 📋 Prerequisites

- **Node.js** (LTS version recommended)
- **Google Gemini API Key**: Obtain one from [Google AI Studio](https://aistudio.google.com/).

## ⚙️ Installation

1. Clone the repository or download the source code.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your API key:
   ```env
   VITE_API_KEY=your_gemini_api_key_here
   ```

## 🏃 Running Locally

To start the development server:
```bash
npm run dev
```

## 🌐 Deployment on Linux (Nginx)

1. **Build the project**:
   ```bash
   npm run build
   ```
2. **Upload the `dist/` folder** to your server (e.g., `/var/www/labprocessor`).
3. **Configure Nginx**:
   ```nginx
   server {
       listen 80;
       server_name chromatografiabrasil.com.br;

       root /var/www/labprocessor;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
4. Restart Nginx: `sudo systemctl restart nginx`.

## ⚖️ Calculation Logic

The system uses the following constants by default (configurable in the "Settings" tab):
- **Area**: 1160 m²
- **Velocity**: 60 m/min
- **Alpha**: 4 (segments per prep)
- **Setup Factor**: 5 min (fixed per test)
- **Register Factor**: 0.5x (multiplier of calculation time)

---
*Developed for Pharmaceutical Excellence.*
