# Pretty Touch – Beauty & Home Salon

A React + Vite salon website with a Node.js/Express API and MongoDB storage for salon profile details, service categories and rates, profile/service photos, and customer appointment requests.

## Set up MongoDB

1. Install Node.js 18+ and create a MongoDB database (MongoDB Atlas or a local MongoDB server).
2. Set `MONGODB_URI` to use the `prettyBeaty` database and `JWT_SECRET` to a random value of at least 32 characters in `.env`. Keep `.env` private; it is excluded from Git. The admin password is created in the website, not in `.env`.
3. In Atlas, allow the machine running the app in the project's Network Access list and create a database user with access to the `prettyBeaty` database.
4. Run `npm install`, then `npm run dev`. Open the Vite URL (usually http://localhost:5173).

The API connects to MongoDB at startup and creates the initial Pretty Touch profile and service menu the first time the database is empty. The Vite development server proxies API requests to port 3001.

## Admin and appointments

On the first visit, click **Admin** at the bottom-left and create the single admin password (at least 12 characters). The site stores only a bcrypt hash in MongoDB; the password is not kept in `.env` or hardcoded in frontend code. Change it any time from the admin **Security** tab. Complete first-time setup immediately after deployment so nobody else can claim the initial admin account.

Admins can add, edit and delete services; each service stores its category, name, rate, products used, time in minutes, description and photo in the MongoDB `services` collection. Products can be entered as comma-separated text. A service photo can be removed while editing; its stored image is deleted when no other site content uses it. The public booking form stores customer name, phone, requested service, date/time and optional notes. The separate **Appointments** screen shows pending, confirmed, completed and cancelled counts and groups requests by their local appointment date. Admins can update status or delete requests, and completed requests are struck through.

Use the **Dark/Light** toggle in the header to change the site theme. The preference is saved in that browser.

Uploaded images are stored as MongoDB documents and limited to 2 MB per image. Admin sessions use an HTTP-only cookie and expire after eight hours. Protect the database credentials and `.env`, use HTTPS in production, and configure `HOST=0.0.0.0`, `CLIENT_ORIGIN`, and `NODE_ENV=production` for your deployment. For production, route `/api` requests to the Node API and serve the frontend from the same origin (or configure the hosting proxy and CORS origin accordingly). Back up the MongoDB database regularly.

### Deploying to Vercel

The root `api/handler.js` function and `vercel.json` rewrite route `/api/*` requests to the Express API. Add `MONGODB_URI` (pointing at `prettyBeaty`) and a random `JWT_SECRET` of at least 32 characters to the Vercel project's Environment Variables; local `.env` values are not automatically uploaded. Admin setup and password changes happen on the website. Set the same-origin API rewrites and allow Vercel to reach your MongoDB Atlas cluster.

## WhatsApp and Instagram setup

- Enter the admin's WhatsApp number with country code and digits only (for example `919876543210` for India +91) in **Admin → Profile**.
- Enter the Instagram profile URL, for example `https://www.instagram.com/yourbeautypage/`.
- After a booking is saved, the site opens WhatsApp with a message addressed to the admin containing the customer's name, phone, service, date/time and notes. The customer must tap **Send** in WhatsApp. A website cannot silently send a message from a personal WhatsApp account; automatic sending requires the official WhatsApp Business API.
- Instagram appears in the footer when configured.
