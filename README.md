<div align="center">
  <h1>Roxanne 🚀</h1>
  <p><b><i>Every Doc You Make</i></b></p>
  <p>A sleek, production-ready document converter and PDF manipulation suite with a premium dark-themed UI and powerful, fast processing.</p>
</div>

---

## 🌟 Overview

**Roxanne** is an all-in-one document management platform designed to make PDF operations and file conversions fast, secure, and visually stunning. Built with a modern tech stack, Roxanne offers a seamless, responsive user experience alongside a robust backend to handle heavy document processing securely.

Whether you need to convert a PDF to an editable format, split and merge documents, or protect sensitive files with encryption, Roxanne has you covered.

## ✨ Features

### 📁 Organize
* **Merge PDF:** Combine multiple PDFs into one unified document.
* **Split PDF:** Extract specific pages or split a PDF into individual files.
* **Rotate PDF:** Rotate PDF pages to any orientation.

### 🔄 Convert
* **PDF to Word / PPT / Excel:** Convert your PDFs into fully editable Microsoft Office formats.
* **Word / PPT / Excel to PDF:** Quickly transform office documents into secure PDFs.
* **PDF to JPG:** Convert each page of a PDF into high-quality JPG images (downloaded as a ZIP).
* **JPG to PDF:** Combine multiple images into a single PDF document.

### 🛡️ Security
* **Protect PDF:** Encrypt your PDFs with a secure password.
* **Unlock PDF:** Remove password protection from PDFs.

### 🚀 Optimize & Edit
* **Compress PDF:** Reduce file size significantly without losing quality.
* **OCR PDF:** Make scanned PDFs fully searchable.
* **Watermark PDF:** Add custom text or image watermarks to protect your IP.

## 🛠️ Tech Stack

### Frontend (Client)
* **Framework:** React 18 with [Vite](https://vitejs.dev/)
* **Language:** TypeScript
* **Styling:** Tailwind CSS v3 with a custom glassmorphism dark theme
* **State Management:** Zustand
* **Animations:** Framer Motion
* **Authentication:** Firebase Auth (Google Sign-in)
* **Routing:** React Router v7
* **Icons:** Lucide React

### Backend (Server)
* **Framework:** Node.js + Express 5
* **File Handling:** Multer
* **PDF Processing:** 
  * `pdf-lib` (Core PDF manipulation)
  * `@pdfsmaller/pdf-decrypt` & `@pdfsmaller/pdf-encrypt` (Security operations)
  * `pdf-to-img` & `sharp` (PDF to image conversion)
* **Archive Generation:** `archiver` (Generating ZIP files on the fly)
* **Rate Limiting & Security:** `express-rate-limit`, `cors`
* **Office Document Conversion:** Handled via LibreOffice CLI integration

## 🏗️ Architecture & Deployment

The repository uses a monolithic structure with distinct client and server directories:

```
/Roxanne
├── client/          # Vite + React Frontend
├── server/          # Express.js Backend
├── shared/          # Shared TypeScript definitions
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

* **Frontend Hosting:** Deployed on **Vercel** for optimal global edge delivery.
* **Backend Hosting:** Deployed on **Hugging Face** using Docker containers, providing the necessary environment (including LibreOffice) for complex document transformations.

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v20 or higher)
* [pnpm](https://pnpm.io/) package manager
* [LibreOffice](https://www.libreoffice.org/) (Required for local Office-to-PDF conversion, otherwise a fallback mock conversion is executed)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SrinivasaPrasadGade/Roxanne.git
   cd Roxanne
   ```

2. **Install dependencies across the workspace:**
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables:**
   * Create a `.env` file in the `server` directory using the provided `.env.example`.
   * Add your Firebase configuration keys to the frontend environment variables if testing authentication.
   ```bash
   cp .env.example server/.env
   ```

4. **Run the Development Servers:**
   * This command will concurrently start the Vite dev server for the frontend and the Nodemon server for the backend.
   ```bash
   pnpm dev
   ```

   * **Client:** `http://localhost:5173`
   * **Server:** `http://localhost:3001`

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/SrinivasaPrasadGade/Roxanne/issues).

## 📝 License

This project is open-source and available under standard terms.
