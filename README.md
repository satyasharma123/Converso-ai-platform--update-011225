# Converso Application

A modern conversation management platform with multi-channel inbox, sales pipeline, and team collaboration features.

## 🚀 Features

- **Multi-Channel Inbox**: Email and LinkedIn conversation management
- **Sales Pipeline**: Kanban board for lead management
- **Team Collaboration**: Admin and SDR role-based access
- **Gmail Integration**: OAuth-based Gmail account connection
- **Routing Rules**: Automated conversation routing
- **Analytics**: Performance metrics and insights
- **Settings Management**: Profile, workspace, and integration settings

## 📁 Project Structure

```
Converso-Application/
├── Converso-backend/     # Express.js backend API
│   ├── src/
│   │   ├── api/         # Database query layer
│   │   ├── services/    # Business logic layer
│   │   ├── routes/      # API route handlers
│   │   └── utils/       # Utilities and helpers
│   └── package.json
│
├── Converso-frontend/    # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Page components
│   │   └── lib/         # API clients and utilities
│   └── package.json
│
└── README.md
```

## 🛠️ Tech Stack

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Supabase** - Database and authentication
- **Google APIs** - Gmail integration

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Query** - Data fetching
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Google Cloud Console account (for Gmail OAuth)

### Backend Setup

1. **Navigate to backend:**
   ```bash
   cd Converso-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create `.env` file:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/integrations/gmail/callback
   FRONTEND_URL=http://localhost:8080
   PORT=3001
   ```

4. **Run database migrations:**
   - Run SQL scripts in Supabase SQL Editor:
     - `Converso-frontend/supabase/migrations/*.sql`

5. **Start backend server:**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend:**
   ```bash
   cd Converso-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create `.env` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   VITE_API_URL=http://localhost:3001
   ```

4. **Start frontend server:**
   ```bash
   npm run dev
   ```

## 📝 Environment Variables

### Backend (.env)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required for RLS bypass)
- `GOOGLE_OAUTH_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_OAUTH_REDIRECT_URI` - OAuth callback URL
- `FRONTEND_URL` - Frontend URL for OAuth redirects
- `PORT` - Backend server port (default: 3001)

### Frontend (.env)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key
- `VITE_API_URL` - Backend API URL

## 🔐 Authentication

- **Supabase Auth** - User authentication
- **Role-based Access** - Admin and SDR roles
- **First user** - Automatically becomes Admin
- **Subsequent users** - Must be invited by Admin

## 🔌 Integrations

### Gmail OAuth Setup

1. **Google Cloud Console:**
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Set redirect URI: `http://localhost:3001/api/integrations/gmail/callback`

2. **OAuth Consent Screen:**
   - Set to "External"
   - Add required scopes
   - Add test users

3. **Connect Gmail:**
   - Go to Settings → Integrations
   - Click "Connect Gmail"
   - Authorize the app

## 📊 Database

- **Supabase PostgreSQL** - Main database
- **Row Level Security (RLS)** - Enabled on all tables
- **Migrations** - SQL scripts in `Converso-frontend/supabase/migrations/`

## 🧪 Development

### Backend
```bash
cd Converso-backend
npm run dev      # Start development server
npm run build    # Build for production
npm run type-check  # Type check
```

### Frontend
```bash
cd Converso-frontend
npm run dev      # Start development server
npm run build    # Build for production
```

## 📚 API Documentation

### Backend Endpoints
- `GET /health` - Health check
- `GET /api/conversations` - List conversations
- `GET /api/messages/:conversationId` - Get messages
- `GET /api/integrations/gmail/connect` - Start Gmail OAuth
- `GET /api/integrations/gmail/callback` - Gmail OAuth callback
- `GET /api/settings/*` - Settings endpoints

See backend code for full API documentation.

## 🔒 Security

- **Environment variables** - Never commit `.env` files
- **Service role key** - Only used on backend, never exposed
- **RLS policies** - Database-level security
- **OAuth tokens** - Encrypted in database

## 📄 License

Private project - All rights reserved

## 👥 Contributing

This is a private project. Contact the project owner for contribution guidelines.

---

**Built with ❤️ using React, Express, and Supabase**

