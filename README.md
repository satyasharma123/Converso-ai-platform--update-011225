# Converso AI Platform

A modern conversation management platform with multi-channel inbox, sales pipeline, and team collaboration features.

## 🏗️ Project Structure

This is a **monorepo** containing both frontend and backend:

```
Converso-ai-platform/
├── Converso-backend/          # Express.js Backend API
│   ├── src/
│   │   ├── api/              # Database query layer
│   │   ├── services/         # Business logic layer
│   │   ├── routes/           # API route handlers
│   │   ├── middleware/       # Auth and validation
│   │   └── utils/            # Utilities
│   ├── package.json
│   └── README.md
│
├── Converso-frontend/         # React Frontend Application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   └── lib/              # API clients
│   ├── package.json
│   └── README.md
│
└── README.md                  # This file
```

## 🚀 Quick Start

### Backend Setup

```bash
cd Converso-backend
npm install

# Create .env file with:
# SUPABASE_URL=your_url
# SUPABASE_ANON_KEY=your_key
# SUPABASE_SERVICE_ROLE_KEY=your_service_key
# GOOGLE_OAUTH_CLIENT_ID=your_client_id
# GOOGLE_OAUTH_CLIENT_SECRET=your_secret
# FRONTEND_URL=http://localhost:8080

npm run dev
```

### Frontend Setup

```bash
cd Converso-frontend
npm install

# Create .env file with:
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_PUBLISHABLE_KEY=your_key
# VITE_API_URL=http://localhost:3001

npm run dev
```

## 📚 Documentation

- **Backend:** See `Converso-backend/README.md`
- **Frontend:** See `Converso-frontend/README.md`
- **Setup Guides:** See individual `.md` files in root

## 🔗 Repository

**GitHub:** https://github.com/satyasharma123/Converso-ai-platform

## 🛠️ Tech Stack

### Backend
- Express.js + TypeScript
- Supabase (Database + Auth)
- Google APIs (Gmail OAuth)

### Frontend
- React + TypeScript
- Vite
- React Query
- Tailwind CSS
- shadcn/ui

## 📝 License

Private project - All rights reserved

---

**Built with ❤️ using React, Express, and Supabase**
