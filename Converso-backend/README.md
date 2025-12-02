# Converso Backend API

Express.js backend API server for Converso Application.

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Run database seed
npm run seed:simple
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

## 📋 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run type-check` - Type check without emitting
- `npm run seed` - Seed database (requires service role key)
- `npm run seed:simple` - Simple seed (works with existing users)

## 🔧 Environment Variables

Create a `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Optional, for seeding
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8082

# SMTP Configuration (for sending invitation emails)
# These should match the SMTP settings configured in Supabase Dashboard
# Go to: Supabase Dashboard > Project Settings > Authentication > SMTP Settings
# Based on your Supabase configuration:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=info@leadnex.co
SMTP_PASSWORD=your_smtp_password_here  # Get this from Supabase Dashboard (it's masked for security)
SMTP_FROM_EMAIL=info@leadnex.co  # Optional, defaults to SMTP_USER
SMTP_FROM_NAME=Converso AI  # Optional, defaults to "Converso AI"
SMTP_SECURE=true  # true for port 465 (SSL), false for port 587 (TLS)
```

**Important:** 
- The SMTP password is the same one configured in Supabase Dashboard
- Since Supabase masks the password for security, you'll need to re-enter it in your `.env` file
- If you don't remember the password, you can update it in Supabase Dashboard and then use the new password in your `.env` file
- The SMTP settings in Supabase are used for auth emails, and we use the same credentials for custom invitation emails

## 🐳 Docker

### Build and Run

```bash
# Build image
docker build -t converso-backend .

# Run container
docker run -p 3001:3001 --env-file .env converso-backend
```

### Docker Compose

```bash
docker-compose up -d
```

## 📦 PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Stop
pm2 stop converso-backend
```

## 📡 API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `GET /api/conversations` - List conversations
- `GET /api/messages` - List messages
- `GET /api/pipeline-stages` - List pipeline stages
- `GET /api/team-members` - List team members
- `GET /api/connected-accounts` - List connected accounts

### Search Endpoints
- `GET /api/search/conversations?q=keyword` - Search conversations
- `GET /api/search/messages?q=keyword` - Search messages

### Analytics Endpoints
- `GET /api/analytics/overview` - Analytics overview
- `GET /api/analytics/conversion-funnel` - Conversion funnel
- `GET /api/analytics/response-time` - Response time stats

### Test Endpoints (Development only)
- `GET /api/test/db` - Test database connection
- `GET /api/test/tables` - Check table status

## 🔐 Authentication

The API supports authentication via:
- JWT token in `Authorization: Bearer <token>` header
- User ID in `x-user-id` header (for development/mock auth)
- User role in `x-user-role` header

## 📝 Database Seeding

### Option 1: Simple Seed (Recommended)
```bash
npm run seed:simple
```
Works with existing users created via frontend signup.

### Option 2: Full Seed (Requires Service Role Key)
```bash
# Set SUPABASE_SERVICE_ROLE_KEY in .env
npm run seed
```
Creates users and all sample data.

## 🚢 Deployment

### Vercel / Netlify
Not recommended for Express apps. Use Railway, Render, or Fly.io instead.

### Railway
1. Connect your GitHub repo
2. Set environment variables
3. Deploy

### Render
1. Create new Web Service
2. Connect repository
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add environment variables

### Fly.io
```bash
fly launch
fly secrets set SUPABASE_URL=...
fly deploy
```

## 📊 Monitoring

- Health check: `GET /health`
- Logs: Check PM2 logs or Docker logs
- Error tracking: Consider adding Sentry or similar

## 🔒 Security Notes

- Never commit `.env` file
- Use service role key only on server
- Enable CORS only for trusted domains in production
- Add rate limiting in production
- Use HTTPS in production

