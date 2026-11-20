import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { defaultCategories, defaultProfile } from '../src/defaults.js';

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter(key => !process.env[key] || process.env[key].startsWith('replace-with-') || /<[^>]+>/.test(process.env[key]));
if (missingEnv.length) {
    throw new Error(`Set the following values in .env before starting the API: ${missingEnv.join(', ')}`);
}
if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
}

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const cookieName = 'pt_admin';
const tokenLifetime = '8h';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '3mb' }));
app.use(cookieParser());

const contentSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    profile: { type: mongoose.Schema.Types.Mixed, required: true },
    categories: { type: [mongoose.Schema.Types.Mixed], required: true },
    servicesInitialized: { type: Boolean, default: false }
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
    _id: { type: String, default: 'primary' },
    passwordHash: { type: String, required: true }
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
    categoryId: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, required: true, trim: true, maxlength: 120 },
    categoryIcon: { type: String, default: '', maxlength: 20 },
    serviceName: { type: String, required: true, trim: true, maxlength: 160 },
    price: { type: Number, min: 0, max: 100000000, default: null },
    productsUsed: { type: [String], default: [] },
    time: { type: Number, min: 0, max: 1440, default: null },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    image: { type: String, maxlength: 200, default: '' }
}, { timestamps: true });

serviceSchema.index({ categoryId: 1, serviceName: 1 });

const appointmentSchema = new mongoose.Schema({
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    service: { type: String, required: true, trim: true, maxlength: 160 },
    date: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' }
}, { timestamps: true });

const imageSchema = new mongoose.Schema({
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true }
}, { timestamps: true });

const Content = mongoose.model('Content', contentSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Service = mongoose.model('Service', serviceSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Image = mongoose.model('Image', imageSchema);

function issueAdminSession(res) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: tokenLifetime });
    res.cookie(cookieName, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/'
    });
}

function isAdmin(req, res, next) {
    const token = req.cookies[cookieName];
    if (!token) return res.status(401).json({ error: 'Admin login required.' });
    try {
        const session = jwt.verify(token, process.env.JWT_SECRET);
        if (session.role !== 'admin') throw new Error('Invalid admin session.');
        next();
    } catch {
        res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: isProduction });
        res.status(401).json({ error: 'Your admin session has expired. Please sign in again.' });
    }
}

function cleanContent(body) {
    const profileFields = ['brand', 'tagline', 'about', 'owner', 'phone', 'whatsapp', 'instagram', 'location', 'hours', 'photo', 'cover'];
    const text = (value, limit) => typeof value === 'string' && value.length <= limit ? value : null;
    if (!body || typeof body !== 'object' || !body.profile || typeof body.profile !== 'object' || !Array.isArray(body.categories)) return null;

    const profile = {};
    for (const key of profileFields) {
        const value = text(body.profile[key], key === 'about' ? 3000 : 500);
        if (value === null) return null;
        profile[key] = value;
    }
    if (body.categories.length > 50) return null;

    const categories = [];
    for (const category of body.categories) {
        if (!category || typeof category !== 'object') return null;
        const id = text(category.id, 100);
        const name = text(category.name, 120);
        const icon = text(category.icon, 20);
        if (!id || !name || icon === null) return null;
        categories.push({ id, name, icon });
    }
    return { profile, categories };
}

function cleanService(body, category) {
    if (!body || typeof body !== 'object' || !category) return null;
    const { serviceName, price, productsUsed, time, description = '', image = '' } = body;
    if (typeof serviceName !== 'string' || !serviceName.trim() || serviceName.length > 160) return null;
    if (price !== null && price !== '' && (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 100000000)) return null;
    if (time !== null && time !== '' && (!Number.isInteger(Number(time)) || Number(time) < 0 || Number(time) > 1440)) return null;
    if (!Array.isArray(productsUsed) || productsUsed.length > 50 || productsUsed.some(product => typeof product !== 'string' || !product.trim() || product.length > 120)) return null;
    if (typeof description !== 'string' || description.length > 1000 || typeof image !== 'string' || image.length > 200) return null;
    return {
        categoryId: category.id,
        category: category.name,
        categoryIcon: category.icon,
        serviceName: serviceName.trim(),
        price: price === '' ? null : price,
        productsUsed: productsUsed.map(product => product.trim()),
        time: time === '' ? null : (time == null ? null : Number(time)),
        description: description.trim(),
        image
    };
}

app.get('/api/health', (req, res) => {
    res.json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'database-unavailable' });
});

app.get('/api/content', async (req, res, next) => {
    try {
        const content = await Content.findOne({ key: 'salon' }).lean();
        if (!content) return res.status(503).json({ error: 'Salon content is not initialized.' });
        res.json({ profile: content.profile, categories: content.categories });
    } catch (error) {
        next(error);
    }
});

app.put('/api/content', isAdmin, async (req, res, next) => {
    const content = cleanContent(req.body);
    if (!content) return res.status(400).json({ error: 'Salon profile or services contain invalid data.' });
    try {
        await Content.findOneAndUpdate({ key: 'salon' }, content, { new: true, runValidators: true });
        res.json({ message: 'Salon content saved.' });
    } catch (error) {
        next(error);
    }
});

app.get('/api/services', async (req, res, next) => {
    try {
        const services = await Service.find().sort({ category: 1, serviceName: 1 }).lean();
        res.json(services);
    } catch (error) {
        next(error);
    }
});

app.post('/api/services', isAdmin, async (req, res, next) => {
    try {
        const content = await Content.findOne({ key: 'salon' }).lean();
        const category = content?.categories.find(item => item.id === req.body?.categoryId);
        const service = cleanService(req.body, category);
        if (!service) return res.status(400).json({ error: 'Service details are invalid or the category does not exist.' });
        const created = await Service.create(service);
        res.status(201).json(created);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'A service with that name already exists in this category.' });
        next(error);
    }
});

app.patch('/api/services/:id', isAdmin, async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid service id.' });
    try {
        const content = await Content.findOne({ key: 'salon' }).lean();
        const category = content?.categories.find(item => item.id === req.body?.categoryId);
        const service = cleanService(req.body, category);
        if (!service) return res.status(400).json({ error: 'Service details are invalid or the category does not exist.' });
        const updated = await Service.findByIdAndUpdate(req.params.id, service, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ error: 'Service not found.' });
        res.json(updated);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'A service with that name already exists in this category.' });
        next(error);
    }
});

app.delete('/api/services/:id', isAdmin, async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid service id.' });
    try {
        const deleted = await Service.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Service not found.' });
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const setupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false });
const validAdminPassword = password => typeof password === 'string' &&
    Buffer.byteLength(password, 'utf8') >= 12 && Buffer.byteLength(password, 'utf8') <= 72;

app.get('/api/auth/status', async (req, res, next) => {
    try {
        res.json({ configured: Boolean(await Admin.exists({ _id: 'primary' })) });
    } catch (error) {
        next(error);
    }
});

app.post('/api/auth/setup', setupLimiter, async (req, res, next) => {
    const password = req.body?.password;
    if (!validAdminPassword(password)) {
        return res.status(400).json({ error: 'Choose a password between 12 and 72 UTF-8 bytes.' });
    }
    try {
        if (await Admin.exists({ _id: 'primary' })) {
            return res.status(409).json({ error: 'Admin is already set up. Please sign in.' });
        }
        await Admin.create({ _id: 'primary', passwordHash: await bcrypt.hash(password, 12) });
        issueAdminSession(res);
        res.status(201).json({ message: 'Admin account created.' });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'Admin is already set up. Please sign in.' });
        next(error);
    }
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
    const password = req.body?.password;
    if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ error: 'Enter a valid admin password.' });
    }
    try {
        const administrator = await Admin.findById('primary').select('passwordHash');
        if (!administrator) return res.status(409).json({ error: 'Admin setup is required before signing in.' });
        if (!(await bcrypt.compare(password, administrator.passwordHash))) {
            return res.status(401).json({ error: 'Incorrect admin password.' });
        }
        issueAdminSession(res);
        res.json({ message: 'Signed in.' });
    } catch (error) {
        next(error);
    }
});

app.get('/api/auth/me', isAdmin, (req, res) => res.json({ authenticated: true }));
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: isProduction, path: '/' });
    res.json({ message: 'Signed out.' });
});

app.post('/api/auth/password', isAdmin, async (req, res, next) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !validAdminPassword(newPassword)) {
        return res.status(400).json({ error: 'Enter your current password and choose a new password of 12 to 72 UTF-8 bytes.' });
    }
    if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'Your new password must be different from the current password.' });
    }
    try {
        const administrator = await Admin.findById('primary').select('passwordHash');
        if (!administrator || !(await bcrypt.compare(currentPassword, administrator.passwordHash))) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }
        const passwordHash = await bcrypt.hash(newPassword, 12);
        const updated = await Admin.findOneAndUpdate(
            { _id: 'primary', passwordHash: administrator.passwordHash },
            { $set: { passwordHash } },
            { new: true }
        );
        if (!updated) return res.status(409).json({ error: 'Password changed in another session. Sign in again.' });
        issueAdminSession(res);
        res.json({ message: 'Admin password changed.' });
    } catch (error) {
        next(error);
    }
});

app.post('/api/images', isAdmin, async (req, res, next) => {
    const match = typeof req.body?.dataUrl === 'string'
        ? req.body.dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/)
        : null;
    if (!match) return res.status(400).json({ error: 'Upload a JPEG, PNG, WebP or GIF image.' });
    const data = Buffer.from(match[2], 'base64');
    if (!data.length || data.length > 2 * 1024 * 1024) return res.status(413).json({ error: 'Images must be smaller than 2 MB.' });
    try {
        const image = await Image.create({ contentType: match[1], data });
        res.status(201).json({ url: `/api/images/${image.id}` });
    } catch (error) {
        next(error);
    }
});

app.get('/api/images/:id', async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
    try {
        const image = await Image.findById(req.params.id).select('contentType data');
        if (!image) return res.status(404).end();
        const data = Buffer.from(image.data);
        res.set({ 'Content-Type': image.contentType, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
        res.end(data);
    } catch (error) {
        next(error);
    }
});

app.delete('/api/images/:id', isAdmin, async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid image id.' });
    const imageUrl = `/api/images/${req.params.id}`;
    try {
        const [content, serviceReference] = await Promise.all([
            Content.findOne({ key: 'salon' }).select('profile.photo profile.cover').lean(),
            Service.exists({ image: imageUrl })
        ]);
        if (content?.profile?.photo === imageUrl || content?.profile?.cover === imageUrl || serviceReference) {
            return res.status(409).json({ error: 'This image is still used by another part of the site.' });
        }
        const deleted = await Image.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Image not found.' });
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

app.post('/api/appointments', rateLimit({ windowMs: 60 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false }), async (req, res, next) => {
    const { customerName, phone, service, date, notes = '' } = req.body || {};
    const appointmentDate = new Date(date);
    if (typeof customerName !== 'string' || !customerName.trim() || customerName.length > 120 ||
        typeof phone !== 'string' || !phone.trim() || phone.length > 30 ||
        typeof service !== 'string' || !service.trim() || service.length > 160 ||
        typeof date !== 'string' || Number.isNaN(appointmentDate.getTime()) ||
        typeof notes !== 'string' || notes.length > 1000) {
        return res.status(400).json({ error: 'Please enter a valid name, phone, service, appointment date and notes.' });
    }
    try {
        const appointment = await Appointment.create({
            customerName: customerName.trim(),
            phone: phone.trim(),
            service: service.trim(),
            date: appointmentDate,
            notes: notes.trim()
        });
        res.status(201).json({ id: appointment.id, message: 'Appointment request received.' });
    } catch (error) {
        next(error);
    }
});

app.get('/api/appointments', isAdmin, async (req, res, next) => {
    try {
        const appointments = await Appointment.find().sort({ date: 1, createdAt: -1 }).lean();
        res.json(appointments);
    } catch (error) {
        next(error);
    }
});

app.patch('/api/appointments/:id', isAdmin, async (req, res, next) => {
    const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!mongoose.isValidObjectId(req.params.id) || !allowedStatuses.includes(req.body?.status)) {
        return res.status(400).json({ error: 'Invalid appointment or status.' });
    }
    try {
        const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
        if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
        res.json(appointment);
    } catch (error) {
        next(error);
    }
});

app.delete('/api/appointments/:id', isAdmin, async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid appointment id.' });
    try {
        const deleted = await Appointment.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Appointment not found.' });
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'The request could not be completed. Please try again.' });
});

await mongoose.connect(process.env.MONGODB_URI);
await Service.init();
await Content.updateOne(
    { key: 'salon' },
    {
        $setOnInsert: {
            key: 'salon',
            profile: defaultProfile,
            categories: defaultCategories.map(({ id, name, icon }) => ({ id, name, icon })),
            servicesInitialized: false
        }
    },
    { upsert: true }
);
const content = await Content.findOne({ key: 'salon' }).lean();
if (!content.servicesInitialized) {
    const categories = content.categories || [];
    const legacyServices = categories.flatMap(category => (category.items || []).map(service => ({
        categoryId: category.id,
        category: category.name,
        categoryIcon: category.icon || '',
        serviceName: service.name,
        price: service.price === '' || service.price == null ? null : Number(service.price),
        productsUsed: Array.isArray(service.productsUsed) ? service.productsUsed : [],
        time: service.time == null ? null : Number(service.time),
        description: service.description || '',
        image: service.image || ''
    })));
    if (await Service.countDocuments() === 0) {
        const servicesToSeed = legacyServices.length
            ? legacyServices
            : defaultCategories.flatMap(category => category.items.map(service => ({
                categoryId: category.id,
                category: category.name,
                categoryIcon: category.icon,
                serviceName: service.name,
                price: null,
                productsUsed: [],
                time: null,
                description: service.description,
                image: ''
            })));
        if (servicesToSeed.length) await Service.insertMany(servicesToSeed);
    }
    await Content.updateOne(
        { key: 'salon' },
        { $set: { categories: categories.map(({ id, name, icon }) => ({ id, name, icon })), servicesInitialized: true } }
    );
}

if (process.env.VERCEL !== '1') {
    const server = app.listen(port, host, () => console.log(`Pretty Touch API listening on ${host}:${port}`));

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        }));
    }
}

export default app;
