# Pretty Touch – Beauty & Home Salon

A React + Vite salon website with a Node.js/Express API and MongoDB storage for salon profile details, service categories and rates, profile/service photos, and customer appointment requests.

## Set up MongoDB

1. Install Node.js 18+ and create a MongoDB database (MongoDB Atlas or a local MongoDB server).
2. Set `MONGODB_URI` to use the `prettyBeaty` database, `ADMIN_PASSWORD` to a strong admin password, and `JWT_SECRET` to a random value of at least 32 characters in `.env`. Keep `.env` private; it is excluded from Git.
3. In Atlas, allow the machine running the app in the project's Network Access list and create a database user with access to the `prettyBeaty` database.
4. Run `npm install`, then `npm run dev`. Open the Vite URL (usually http://localhost:5173).

The API connects to MongoDB at startup and creates the initial Pretty Touch profile and service menu the first time the database is empty. The Vite development server proxies API requests to port 3001.

## Admin and appointments

Set the single admin password in `.env` as `ADMIN_PASSWORD`; it is not stored in MongoDB or exposed in the frontend. Restart the API after changing it. In development, click **Admin** at the bottom-left and sign in with that password. Admins can add, edit and delete services; each service stores its category, name, rate, products used, time in minutes, description and photo in the MongoDB `services` collection. The public booking form stores customer name, phone, requested service, date/time and optional notes; admins can review requests and update their status.

As requested, admin access is disabled in production builds and by the production API. To manage the same production database, run the development app privately with its MongoDB URI configured; do not expose the development server publicly.

Uploaded images are stored as MongoDB documents and limited to 2 MB per image. Admin sessions use an HTTP-only cookie and expire after eight hours. Protect the database credentials and `.env`, use HTTPS in production, and configure `HOST=0.0.0.0`, `CLIENT_ORIGIN`, and `NODE_ENV=production` for your deployment. For production, route `/api` requests to the Node API and serve the frontend from the same origin (or configure the hosting proxy and CORS origin accordingly). Back up the MongoDB database regularly.

### Deploying to Vercel

The root `api/index.js` function and `vercel.json` rewrite route `/api/*` requests to the Express API. Add `MONGODB_URI` (pointing at `prettyBeaty`) to the Vercel project's Environment Variables; local `.env` values are not automatically uploaded to Vercel. Vercel's production environment keeps admin routes disabled.

## WhatsApp and Instagram setup

- Enter the WhatsApp number with country code and digits only, for example `919876543210` (India +91).
- Enter the Instagram profile URL, for example `https://www.instagram.com/yourbeautypage/`.
- WhatsApp remains available through the public contact details and Instagram appears in the footer when configured.
