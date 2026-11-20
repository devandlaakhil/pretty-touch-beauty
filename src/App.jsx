import React, { useEffect, useMemo, useState } from 'react';
import {
    Instagram, MessageCircle, Menu, X, Sparkles, Heart, Flower2, Plus, Pencil, Trash2,
    Camera, LogOut, LayoutDashboard, ArrowUpRight, Phone, MapPin, Clock, Check, Upload,
    CalendarDays, KeyRound, Sun, Moon
} from 'lucide-react';
import { defaultCategories, defaultProfile } from './defaults.js';

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });
    const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result.error || 'The request could not be completed.');
        error.status = response.status;
        throw error;
    }
    return result;
}

function localDateTimeValue(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const money = value => value !== '' && value != null ? `₹${Number(value).toLocaleString('en-IN')}` : 'Ask for price';
const imageSrc = value => value?.startsWith('/api/images/') ? `${value}?v=2` : value;

function mapService(service) {
    return {
        id: service._id,
        categoryId: service.categoryId,
        name: service.serviceName,
        description: service.description || '',
        price: service.price == null ? '' : String(service.price),
        productsUsed: service.productsUsed || [],
        time: service.time == null ? '' : String(service.time),
        image: service.image || ''
    };
}

function App() {
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem('pretty-touch-theme') === 'dark' ? 'dark' : 'light';
        } catch (error) {
            console.warn('Could not read the saved theme preference.', error);
            return 'light';
        }
    });
    const [profile, setProfile] = useState(defaultProfile);
    const [categories, setCategories] = useState(defaultCategories);
    const [contentReady, setContentReady] = useState(false);
    const [active, setActive] = useState('all');
    const [admin, setAdmin] = useState(false);
    const [logged, setLogged] = useState(false);
    const [adminConfigured, setAdminConfigured] = useState(null);
    const [adminScreen, setAdminScreen] = useState('dashboard');
    const [mobileMenu, setMobileMenu] = useState(false);
    const [modal, setModal] = useState(null);
    const [draft, setDraft] = useState(null);
    const [categoryDraft, setCategoryDraft] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    const [confirmSetupPassword, setConfirmSetupPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [booking, setBooking] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [toast, setToast] = useState('');

    const notify = message => {
        setToast(message);
        setTimeout(() => setToast(''), 3500);
    };

    const loadAppointments = async () => {
        const result = await api('/api/appointments');
        setAppointments(result);
    };

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem('pretty-touch-theme', theme);
        } catch (error) {
            console.warn('Could not save the theme preference.', error);
        }
    }, [theme]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([api('/api/content'), api('/api/services')])
            .then(([content, services]) => {
                if (cancelled) return;
                setProfile(content.profile);
                setCategories(content.categories.map(category => ({
                    ...category,
                    items: services
                        .filter(service => service.categoryId === category.id)
                        .map(mapService)
                })));
                setContentReady(true);
            })
            .catch(error => {
                if (!cancelled) notify(`Could not load salon data: ${error.message}`);
            });
        api('/api/auth/me')
            .then(() => {
                if (cancelled) return;
                setLogged(true);
                setAdmin(true);
                setAdminScreen('dashboard');
                loadAppointments().catch(error => notify(error.message));
            })
            .catch(error => {
                if (!cancelled && error.status !== 401) notify(error.message);
            });
        api('/api/auth/status')
            .then(result => {
                if (!cancelled) setAdminConfigured(result.configured);
            })
            .catch(error => {
                if (!cancelled) notify(`Could not check admin setup: ${error.message}`);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!contentReady || !logged) return undefined;
        const timer = setTimeout(() => {
            api('/api/content', {
                method: 'PUT',
                body: JSON.stringify({ profile, categories })
            }).catch(error => notify(`Could not save your changes: ${error.message}`));
        }, 400);
        return () => clearTimeout(timer);
    }, [profile, categories, contentReady, logged]);

    const allServices = useMemo(
        () => categories.flatMap(category => category.items.map(service => ({
            ...service,
            category: category.name,
            categoryId: category.id
        }))),
        [categories]
    );
    const appointmentCounts = useMemo(() => ({
        pending: appointments.filter(item => item.status === 'pending').length,
        confirmed: appointments.filter(item => item.status === 'confirmed').length,
        completed: appointments.filter(item => item.status === 'completed').length,
        cancelled: appointments.filter(item => item.status === 'cancelled').length
    }), [appointments]);
    const appointmentDateGroups = useMemo(() => {
        const groups = new Map();
        appointments.forEach(appointment => {
            const date = new Date(appointment.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    label: date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                    items: []
                });
            }
            groups.get(key).items.push(appointment);
        });
        return Array.from(groups.values());
    }, [appointments]);
    const visible = active === 'all' ? categories : categories.filter(category => category.id === active);

    const wa = message => {
        const number = (profile.whatsapp || profile.phone).replace(/\D/g, '');
        if (!number) {
            notify('Add your WhatsApp number in Admin → Profile first.');
            return;
        }
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    };

    const openBooking = (service = '') => {
        const suggestedDate = new Date(Date.now() + 60 * 60 * 1000);
        suggestedDate.setMinutes(0, 0, 0);
        setBooking({
            customerName: '',
            phone: '',
            service,
            date: localDateTimeValue(suggestedDate),
            notes: ''
        });
        setModal('booking');
    };

    const submitBooking = async event => {
        event.preventDefault();
        const number = String(profile.whatsapp || profile.phone || '').replace(/\D/g, '');
        const whatsappUrl = number.length >= 8 && number.length <= 15
            ? `https://wa.me/${number}?text=${encodeURIComponent([
                `New appointment request - ${profile.brand}`,
                `Name: ${booking.customerName.trim()}`,
                `Phone: ${booking.phone.trim()}`,
                `Service: ${booking.service}`,
                `Date/time: ${new Date(booking.date).toLocaleString()}`,
                booking.notes.trim() ? `Notes: ${booking.notes.trim()}` : ''
            ].filter(Boolean).join('\n'))}`
            : '';
        const whatsappWindow = whatsappUrl ? window.open('about:blank', '_blank') : null;
        try {
            const result = await api('/api/appointments', {
                method: 'POST',
                body: JSON.stringify({ ...booking, date: new Date(booking.date).toISOString() })
            });
            setModal(null);
            if (whatsappUrl) {
                if (whatsappWindow) {
                    whatsappWindow.opener = null;
                    whatsappWindow.location.replace(whatsappUrl);
                } else {
                    window.location.assign(whatsappUrl);
                }
                notify(`${result.message} Send the prepared WhatsApp message to confirm.`);
            } else {
                notify(`${result.message} Add the admin WhatsApp number with country code in Admin → Profile.`);
            }
        } catch (error) {
            whatsappWindow?.close();
            notify(error.message);
        }
    };

    const openAdmin = async () => {
        if (logged) {
            setAdmin(true);
            return;
        }
        let configured = adminConfigured;
        if (configured === null) {
            try {
                const result = await api('/api/auth/status');
                configured = result.configured;
                setAdminConfigured(configured);
            } catch (error) {
                notify(error.message);
                return;
            }
        }
        setModal(configured ? 'login' : 'setup');
    };

    const setupAdmin = async event => {
        event.preventDefault();
        if (setupPassword !== confirmSetupPassword) {
            notify('The passwords do not match.');
            return;
        }
        try {
            await api('/api/auth/setup', {
                method: 'POST',
                body: JSON.stringify({ password: setupPassword })
            });
            setAdminConfigured(true);
            setSetupPassword('');
            setConfirmSetupPassword('');
            setLogged(true);
            setAdmin(true);
            setAdminScreen('dashboard');
            setModal(null);
            await loadAppointments();
            notify('Admin account created.');
        } catch (error) {
            if (error.status === 409) {
                setAdminConfigured(true);
                setModal('login');
            }
            notify(error.message);
        }
    };

    const login = async event => {
        event.preventDefault();
        try {
            await api('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ password: loginPassword })
            });
            setLoginPassword('');
            setLogged(true);
            setAdmin(true);
            setAdminConfigured(true);
            setAdminScreen('dashboard');
            setModal(null);
            await loadAppointments();
        } catch (error) {
            notify(error.message);
        }
    };

    const changeAdminPassword = async event => {
        event.preventDefault();
        if (newPassword !== confirmNewPassword) {
            notify('The new passwords do not match.');
            return;
        }
        try {
            const result = await api('/api/auth/password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            notify(result.message);
        } catch (error) {
            notify(error.message);
        }
    };

    const logout = async () => {
        try {
            await api('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            notify(error.message);
        } finally {
            setAdmin(false);
            setLogged(false);
        }
    };

    const saveService = async () => {
        if (!draft?.name?.trim()) {
            notify('Please enter a service name.');
            return;
        }
        try {
            const payload = {
                categoryId: draft.categoryId,
                serviceName: draft.name.trim(),
                price: draft.price === '' ? null : Number(draft.price),
                productsUsed: String(draft.productsUsed || '').split(/[,\n]/).map(product => product.trim()).filter(Boolean),
                time: draft.time === '' ? null : Number(draft.time),
                description: draft.description || '',
                image: draft.image || ''
            };
            const saved = await api(draft.id ? `/api/services/${draft.id}` : '/api/services', {
                method: draft.id ? 'PATCH' : 'POST',
                body: JSON.stringify(payload)
            });
            const oldPhotos = [...new Set([
                ...(draft.imagesToDelete || []),
                ...(draft.originalImage && draft.originalImage !== draft.image ? [draft.originalImage] : [])
            ])];
            const photoCleanupErrors = [];
            for (const photo of oldPhotos) {
                const imageId = /^\/api\/images\/([a-f\d]{24})(?:\?.*)?$/i.exec(photo)?.[1];
                if (!imageId) continue;
                try {
                    await api(`/api/images/${imageId}`, { method: 'DELETE' });
                } catch (error) {
                    photoCleanupErrors.push(error.message);
                }
            }
            const service = mapService(saved);
            setCategories(current => current.map(category => category.id === draft.categoryId
                ? {
                    ...category,
                    items: draft.id
                        ? category.items.map(item => item.id === draft.id ? service : item)
                        : [...category.items, service]
                }
                : category));
            setModal(null);
            setDraft(null);
            notify(photoCleanupErrors.length
                ? `Service saved, but a photo could not be deleted: ${photoCleanupErrors[0]}`
                : 'Service saved.');
        } catch (error) {
            notify(error.message);
        }
    };

    const fileToData = (file, onChange) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            notify('Please choose an image smaller than 2 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const result = await api('/api/images', {
                    method: 'POST',
                    body: JSON.stringify({ dataUrl: reader.result })
                });
                onChange(result.url);
            } catch (error) {
                notify(error.message);
            }
        };
        reader.onerror = () => notify('The selected image could not be read.');
        reader.readAsDataURL(file);
    };

    const updateProfile = (key, value) => setProfile(current => ({ ...current, [key]: value }));
    const openService = (category, service = null) => {
        const originalImage = service?.image || '';
        setDraft(service
            ? {
                ...service,
                categoryId: category.id,
                productsUsed: (service.productsUsed || []).join(', '),
                originalImage,
                imagesToDelete: []
            }
            : {
                id: '',
                name: '',
                description: '',
                price: '',
                productsUsed: '',
                time: '',
                image: '',
                categoryId: category.id,
                originalImage: '',
                imagesToDelete: []
            });
        setModal('service');
    };
    const replaceDraftImage = image => setDraft(current => ({
        ...current,
        image,
        imagesToDelete: current.image && current.image !== current.originalImage
            ? [...new Set([...(current.imagesToDelete || []), current.image])]
            : current.imagesToDelete || []
    }));
    const removeDraftImage = () => replaceDraftImage('');
    const deleteService = async (categoryId, id) => {
        if (!confirm('Delete this service?')) return;
        try {
            await api(`/api/services/${id}`, { method: 'DELETE' });
            setCategories(current => current.map(category => category.id === categoryId
                ? { ...category, items: category.items.filter(service => service.id !== id) }
                : category));
            notify('Service deleted.');
        } catch (error) {
            notify(error.message);
        }
    };

    const updateAppointment = async (id, status) => {
        try {
            const updated = await api(`/api/appointments/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });
            setAppointments(current => current.map(appointment => appointment._id === id ? updated : appointment));
        } catch (error) {
            notify(error.message);
        }
    };

    const deleteAppointment = async id => {
        if (!confirm('Delete this appointment? This cannot be undone.')) return;
        try {
            await api(`/api/appointments/${id}`, { method: 'DELETE' });
            setAppointments(current => current.filter(appointment => appointment._id !== id));
            notify('Appointment deleted.');
        } catch (error) {
            notify(error.message);
        }
    };

    const uploadButton = (label, onChange) => (
        <label className="upload-btn">
            <Upload size={16} />{label}
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={event => {
                    fileToData(event.target.files?.[0], onChange);
                    event.target.value = '';
                }}
            />
        </label>
    );

    return <div className="app">
        <header className="header">
            <a className="logo" href="#home">
                <span className="logo-mark"><Flower2 size={25} /></span>
                <span><b>{profile.brand || 'Pretty Touch'}</b><small>BEAUTY & HOME SALON</small></span>
            </a>
            <nav className={mobileMenu ? 'nav open' : 'nav'}>
                <a href="#home" onClick={() => setMobileMenu(false)}>Home</a>
                <a href="#services" onClick={() => setMobileMenu(false)}>Services</a>
                <a href="#about" onClick={() => setMobileMenu(false)}>About</a>
                <a href="#contact" onClick={() => setMobileMenu(false)}>Contact</a>
                <button className="nav-book" onClick={() => openBooking()}>Book an appointment <ArrowUpRight size={16} /></button>
            </nav>
            <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">
                {mobileMenu ? <X /> : <Menu />}
            </button>
            <button
                className="theme-toggle"
                onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                aria-pressed={theme === 'dark'}
            >{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        </header>

        {admin && logged ? <main className="admin-wrap">
            <div className="admin-head">
                <div><span className="eyebrow">WEBSITE CONTROL CENTRE</span><h1>{adminScreen === 'appointments' ? 'Appointments' : adminScreen === 'security' ? 'Security' : 'Manage your salon'}</h1><p>{adminScreen === 'appointments' ? 'Review appointments grouped by date.' : adminScreen === 'security' ? 'Change your admin sign-in password.' : 'Update your profile, prices, services and photos.'}</p></div>
                <button className="outline-btn" onClick={logout}><LogOut size={16} /> Exit admin</button>
            </div>
            <div className="admin-tabs">
                <button className={adminScreen === 'dashboard' ? 'active' : ''} onClick={() => setAdminScreen('dashboard')}><LayoutDashboard size={16} /> Dashboard</button>
                <button className={adminScreen === 'appointments' ? 'active' : ''} onClick={() => setAdminScreen('appointments')}><CalendarDays size={16} /> Appointments</button>
                <button className={adminScreen === 'security' ? 'active' : ''} onClick={() => setAdminScreen('security')}><KeyRound size={16} /> Security</button>
                {adminScreen === 'dashboard' && <>
                    <button onClick={() => document.getElementById('profile-form')?.scrollIntoView({ behavior: 'smooth' })}>Profile & links</button>
                    <button onClick={() => document.getElementById('manage-services')?.scrollIntoView({ behavior: 'smooth' })}>Services & pricing</button>
                </>}
            </div>
            {adminScreen === 'dashboard' ? <>
                <div className="stats">
                    <div><span>Service categories</span><b>{categories.length}</b></div>
                    <div><span>Total services</span><b>{allServices.length}</b></div>
                    <div><span>Priced services</span><b>{allServices.filter(service => service.price !== '').length}</b></div>
                </div>
            <section className="admin-panel" id="profile-form">
                <div className="panel-title"><div><h2>Salon profile</h2><p>This information appears on your public website.</p></div></div>
                <div className="profile-editor">
                    <div className="profile-photo">
                        {profile.photo ? <img src={imageSrc(profile.photo)} alt="Salon profile" /> : <div className="photo-placeholder"><Camera /><span>Profile photo</span></div>}
                        {uploadButton('Change photo', value => updateProfile('photo', value))}
                    </div>
                    <div className="form-grid">
                        <Field label="Salon name" value={profile.brand} onChange={value => updateProfile('brand', value)} />
                        <Field label="Beautician name" value={profile.owner} onChange={value => updateProfile('owner', value)} />
                        <Field label="Tagline" value={profile.tagline} onChange={value => updateProfile('tagline', value)} />
                        <Field label="Phone number" value={profile.phone} onChange={value => updateProfile('phone', value)} placeholder="+91 98765 43210" />
                        <Field label="WhatsApp number (with country code)" value={profile.whatsapp} onChange={value => updateProfile('whatsapp', value)} placeholder="919876543210" />
                        <Field label="Instagram profile URL" value={profile.instagram} onChange={value => updateProfile('instagram', value)} placeholder="https://instagram.com/yourpage" />
                        <Field label="Location / service area" value={profile.location} onChange={value => updateProfile('location', value)} />
                        <Field label="Working hours" value={profile.hours} onChange={value => updateProfile('hours', value)} />
                        <div className="field full"><label>About your salon</label><textarea value={profile.about} onChange={event => updateProfile('about', event.target.value)} rows="4" /></div>
                    </div>
                </div>
            </section>
            <section className="admin-panel" id="manage-services">
                <div className="panel-title">
                    <div><h2>Services & pricing</h2><p>Add, edit or remove services and set prices.</p></div>
                    <button className="primary-btn" onClick={() => { setCategoryDraft(''); setModal('category'); }}><Plus size={17} /> Add category</button>
                </div>
                {categories.map(category => <div className="manage-category" key={category.id}>
                    <div className="manage-cat-title">
                        <h3>{category.icon} {category.name} <small>({category.items.length})</small></h3>
                        <button className="small-add" onClick={() => openService(category)}><Plus size={15} /> Add service</button>
                    </div>
                    {category.items.length === 0 ? <p className="muted">No services yet.</p> : <div className="manage-list">
                        {category.items.map(service => <div className="manage-row" key={service.id}>
                            <div className="mini-service-img">{service.image ? <img src={imageSrc(service.image)} alt="" /> : <Sparkles size={17} />}</div>
                            <div className="manage-service-text"><b>{service.name}</b><span>{money(service.price)}{service.time ? ` · ${service.time} min` : ''}</span></div>
                            <button className="icon-btn" aria-label="Edit" onClick={() => openService(category, service)}><Pencil size={16} /></button>
                            <button className="icon-btn danger" aria-label="Delete" onClick={() => deleteService(category.id, service.id)}><Trash2 size={16} /></button>
                        </div>)}
                    </div>}
                </div>)}
            </section>
                <div className="admin-note"><b>Saved to MongoDB:</b> Profile details, service prices, appointments and uploaded photos are stored in your database.</div>
            </> : adminScreen === 'appointments' ? <>
                <div className="appointment-stats">
                    <div><span>Pending</span><b>{appointmentCounts.pending}</b></div>
                    <div><span>Confirmed</span><b>{appointmentCounts.confirmed}</b></div>
                    <div><span>Completed</span><b>{appointmentCounts.completed}</b></div>
                    <div><span>Cancelled</span><b>{appointmentCounts.cancelled}</b></div>
                </div>
                <section className="admin-panel">
                    <div className="panel-title"><div><h2>Appointment requests</h2><p>Update status or delete an appointment.</p></div></div>
                    {appointmentDateGroups.length === 0 ? <p className="muted">No appointment requests yet.</p> : appointmentDateGroups.map(group => <div className="appointment-date-group" key={group.key}>
                        <div className="appointment-date-heading"><h3>{group.label}</h3><span>{group.items.length} {group.items.length === 1 ? 'appointment' : 'appointments'}</span></div>
                        <div className="appointments-list">
                            {group.items.map(appointment => <article className={`appointment-row ${appointment.status}`} key={appointment._id}>
                                <div className="appointment-info">
                                    <b>{appointment.customerName}</b>
                                    <a href={`tel:${appointment.phone}`}>{appointment.phone}</a>
                                    <span>{appointment.service}</span>
                                    <time>{new Date(appointment.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                                    {appointment.notes && <small>{appointment.notes}</small>}
                                </div>
                                <div className="appointment-actions">
                                    <select aria-label={`Status for ${appointment.customerName}`} value={appointment.status} onChange={event => updateAppointment(appointment._id, event.target.value)}>
                                        {['pending', 'confirmed', 'completed', 'cancelled'].map(status => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                    <button className="icon-btn danger" aria-label={`Delete appointment for ${appointment.customerName}`} onClick={() => deleteAppointment(appointment._id)}><Trash2 size={16} /></button>
                                </div>
                            </article>)}
                        </div>
                    </div>)}
                </section>
            </> : <>
                <section className="admin-panel">
                    <div className="panel-title"><div><h2>Change admin password</h2><p>Your password is stored as a secure hash in the database, never in the frontend or `.env`.</p></div></div>
                    <form className="password-form" onSubmit={changeAdminPassword}>
                        <Field label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} required autoComplete="current-password" />
                        <Field label="New password (at least 12 characters)" type="password" value={newPassword} onChange={setNewPassword} required minLength={12} autoComplete="new-password" />
                        <Field label="Confirm new password" type="password" value={confirmNewPassword} onChange={setConfirmNewPassword} required minLength={12} autoComplete="new-password" />
                        <div className="password-form-actions"><button className="primary-btn" type="submit"><KeyRound size={16} /> Change password</button></div>
                    </form>
                </section>
            </>}
        </main> : <>
            <section className="hero" id="home">
                <div className="hero-copy">
                    <span className="eyebrow"><Sparkles size={14} /> A LITTLE SELF-CARE GOES A LONG WAY</span>
                    <h1>Feel beautiful.<br /><em>Feel like you.</em></h1>
                    <p>{profile.tagline || 'Your beauty, our passion.'} {profile.about}</p>
                    <div className="hero-actions">
                        <button className="primary-btn" onClick={() => openBooking()}>Book an appointment <ArrowUpRight size={17} /></button>
                        <a className="text-link" href="#services">Explore services <span>↓</span></a>
                    </div>
                    <div className="hero-trust"><span><Heart size={16} /> Personalised care</span><span><Flower2 size={16} /> At-home comfort</span></div>
                </div>
                <div className="hero-art">
                    <div className="hero-image">
                        {profile.cover || profile.photo
                            ? <img src={imageSrc(profile.cover || profile.photo)} alt="Pretty Touch beauty salon" />
                            : <div className="hero-placeholder"><Flower2 size={88} /><span>Pretty Touch</span><small>BEAUTY • CARE • CONFIDENCE</small></div>}
                    </div>
                    <div className="floating-note"><span>✿</span><div><b>A moment for you</b><small>Relax. Refresh. Glow.</small></div></div>
                    <div className="hero-circle" />
                </div>
            </section>
            <section className="services-section" id="services">
                <div className="section-heading"><span className="eyebrow">OUR BEAUTY MENU</span><h2>A service for every <em>you.</em></h2><p>From everyday essentials to your most special moments, find the care you deserve.</p></div>
                <div className="filter-row">
                    <button className={active === 'all' ? 'filter active' : 'filter'} onClick={() => setActive('all')}>All services</button>
                    {categories.map(category => <button key={category.id} className={active === category.id ? 'filter active' : 'filter'} onClick={() => setActive(category.id)}>{category.name}</button>)}
                </div>
                <div className="category-grid">{visible.map(category => <article className="category-card" key={category.id}>
                    <div className="category-head"><span className="category-icon">{category.icon}</span><div><h3>{category.name}</h3><small>{category.items.length} services</small></div></div>
                    <div className="service-list">{category.items.map(service => <div className="service-item" key={service.id}>
                        <div className="service-thumb">{service.image ? <img src={imageSrc(service.image)} alt="" /> : <Sparkles size={17} />}</div>
                        <div className="service-info">
                            <b>{service.name}</b>
                            {service.description && <p>{service.description}</p>}
                            {(service.time || service.productsUsed?.length > 0) && <small className="service-extra">
                                {service.time && `${service.time} min`}
                                {service.time && service.productsUsed?.length > 0 && ' · '}
                                {service.productsUsed?.length > 0 && `Products: ${service.productsUsed.join(', ')}`}
                            </small>}
                        </div>
                        <span className="price">{money(service.price)}</span>
                    </div>)}</div>
                    <button className="category-book" onClick={() => openBooking()}><CalendarDays size={15} /> Book a {category.name} appointment <ArrowUpRight size={15} /></button>
                </article>)}</div>
            </section>
            <section className="about-section" id="about">
                <div className="about-photo">{profile.photo ? <img src={imageSrc(profile.photo)} alt="Salon owner" /> : <div><Flower2 size={70} /><span>Pretty Touch</span></div>}</div>
                <div className="about-copy"><span className="eyebrow">A WARM WELCOME</span><h2>Beauty care that feels like <em>you.</em></h2><p>{profile.about}</p><p className="owner">With love, <b>{profile.owner || 'Your Beautician'}</b></p><button className="primary-btn" onClick={() => wa('Hi! I would like to know more about your beauty services.')}>Let's talk <MessageCircle size={17} /></button></div>
            </section>
            <section className="contact-section" id="contact">
                <div><span className="eyebrow">READY FOR YOUR GLOW-UP?</span><h2>Your self-care day<br /><em>starts here.</em></h2><p>Message us to ask a question or book your preferred service.</p><button className="primary-btn" onClick={() => openBooking()}>Book an appointment <CalendarDays size={17} /></button></div>
                <div className="contact-details">
                    <div><MapPin /><span><b>Service area</b><small>{profile.location || 'Add your location'}</small></span></div>
                    <div><Clock /><span><b>Appointments</b><small>{profile.hours || 'By appointment'}</small></span></div>
                    <div><Phone /><span><b>Call / WhatsApp</b><small>{profile.phone || profile.whatsapp || 'Add your phone number'}</small></span></div>
                </div>
            </section>
            <footer className="footer">
                <a className="logo" href="#home"><span className="logo-mark"><Flower2 /></span><span><b>{profile.brand}</b><small>BEAUTY & HOME SALON</small></span></a>
                <p>Made with care. Made for your glow. © {new Date().getFullYear()} {profile.brand}.</p>
                <div className="socials">{profile.instagram && <a href={profile.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a>}<button onClick={() => wa('Hi! I would like to enquire about your services.')} aria-label="WhatsApp"><MessageCircle /></button></div>
            </footer>
        </>}

        {!admin && <button className="floating-wa" onClick={() => openBooking()} aria-label="Book an appointment"><CalendarDays size={21} /><span>Book with us</span></button>}
        {!admin && <button
            className="admin-entry"
            onClick={openAdmin}
        >Admin</button>}

        {modal === 'setup' && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModal(null)}>
            <form className="modal small-modal" onSubmit={setupAdmin}>
                <div className="modal-head"><div><span className="eyebrow">FIRST-TIME SETUP</span><h2>Create admin password</h2></div><button type="button" className="icon-btn" onClick={() => setModal(null)}><X /></button></div>
                <p className="muted">Choose a password with at least 12 characters. It will be stored as a secure hash in your database.</p>
                <Field label="Admin password" type="password" value={setupPassword} onChange={setSetupPassword} required minLength={12} autoComplete="new-password" />
                <Field label="Confirm admin password" type="password" value={confirmSetupPassword} onChange={setConfirmSetupPassword} required minLength={12} autoComplete="new-password" />
                <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setModal(null)}>Cancel</button><button className="primary-btn" type="submit">Create admin</button></div>
            </form>
        </div>}

        {modal === 'login' && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModal(null)}>
            <form className="modal small-modal" onSubmit={login}>
                <div className="modal-head"><div><span className="eyebrow">ADMIN ACCESS</span><h2>Sign in</h2></div><button type="button" className="icon-btn" onClick={() => setModal(null)}><X /></button></div>
                <Field label="Admin password" type="password" value={loginPassword} onChange={setLoginPassword} required autoComplete="current-password" />
                <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setModal(null)}>Cancel</button><button className="primary-btn" type="submit">Sign in</button></div>
            </form>
        </div>}

        {modal === 'booking' && booking && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModal(null)}>
            <form className="modal small-modal" onSubmit={submitBooking}>
                <div className="modal-head"><div><span className="eyebrow">WE LOOK FORWARD TO SEEING YOU</span><h2>Request an appointment</h2></div><button type="button" className="icon-btn" onClick={() => setModal(null)}><X /></button></div>
                <div className="modal-form">
                    <Field label="Your name" value={booking.customerName} onChange={value => setBooking(current => ({ ...current, customerName: value }))} required />
                    <Field label="Phone number" value={booking.phone} onChange={value => setBooking(current => ({ ...current, phone: value }))} required />
                    <div className="field full"><label htmlFor="booking-service">Service</label><select id="booking-service" required value={booking.service} onChange={event => setBooking(current => ({ ...current, service: event.target.value }))}>
                        <option value="">Choose a service</option>
                        {allServices.map(service => <option key={service.id} value={service.name}>{service.category} — {service.name}</option>)}
                    </select></div>
                    <Field label="Preferred date & time" type="datetime-local" value={booking.date} onChange={value => setBooking(current => ({ ...current, date: value }))} required />
                    <div className="field full"><label htmlFor="booking-notes">Anything we should know? (optional)</label><textarea id="booking-notes" rows="3" maxLength="1000" value={booking.notes} onChange={event => setBooking(current => ({ ...current, notes: event.target.value }))} /></div>
                    {(profile.whatsapp || profile.phone) && <p className="booking-whatsapp-note">After submitting, WhatsApp opens with your appointment details. Tap <b>Send</b> to message the salon.</p>}
                </div>
                <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setModal(null)}>Cancel</button><button className="primary-btn" type="submit"><CalendarDays size={16} /> Request booking</button></div>
            </form>
        </div>}

        {modal === 'service' && draft && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModal(null)}>
            <div className="modal">
                <div className="modal-head"><div><span className="eyebrow">SERVICE DETAILS</span><h2>{categories.some(category => category.items.some(item => item.id === draft.id)) ? 'Edit service' : 'Add a service'}</h2></div><button className="icon-btn" onClick={() => setModal(null)}><X /></button></div>
                <div className="modal-form">
                    <Field label="Service name" value={draft.name} onChange={value => setDraft(current => ({ ...current, name: value }))} />
                    <Field label="Price (INR)" value={draft.price} onChange={value => setDraft(current => ({ ...current, price: value.replace(/[^0-9.]/g, '') }))} placeholder="e.g. 499" />
                    <Field label="Time required (minutes)" type="number" value={draft.time} onChange={value => setDraft(current => ({ ...current, time: value.replace(/\D/g, '') }))} placeholder="e.g. 45" />
                    <div className="field full"><label htmlFor="service-products">Products used (comma-separated)</label><textarea id="service-products" rows="2" value={draft.productsUsed} onChange={event => setDraft(current => ({ ...current, productsUsed: event.target.value }))} placeholder="e.g. cleanser, toner, moisturizer" /></div>
                    <div className="field full"><label>Description</label><textarea rows="3" value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Describe what the customer can expect..." /></div>
                    <div className="field full"><label>Service photo</label><div className="image-upload-preview">{draft.image ? <img src={imageSrc(draft.image)} alt="Service preview" /> : <div><Camera /><span>No image selected</span></div>}{uploadButton('Upload photo', replaceDraftImage)}{draft.image && <button type="button" className="outline-btn remove-photo-btn" onClick={removeDraftImage}><Trash2 size={15} /> Remove photo</button>}</div></div>
                </div>
                <div className="modal-actions"><button className="outline-btn" onClick={() => setModal(null)}>Cancel</button><button className="primary-btn" onClick={saveService}><Check size={17} /> Save service</button></div>
            </div>
        </div>}

        {modal === 'category' && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModal(null)}>
            <div className="modal small-modal"><div className="modal-head"><h2>Add category</h2><button className="icon-btn" onClick={() => setModal(null)}><X /></button></div>
                <Field label="Category name" value={categoryDraft} onChange={setCategoryDraft} placeholder="e.g. Nail Art" />
                <div className="modal-actions"><button className="outline-btn" onClick={() => setModal(null)}>Cancel</button><button className="primary-btn" onClick={() => {
                    if (!categoryDraft.trim()) return;
                    setCategories(current => [...current, { id: crypto.randomUUID(), name: categoryDraft.trim(), icon: '🌷', items: [] }]);
                    setModal(null);
                    notify('Category added.');
                }}>Add category</button></div>
            </div>
        </div>}
        {toast && <div className="toast" role="status">{toast}</div>}
    </div>;
}

function Field({ label, value, onChange, placeholder = '', type = 'text', required = false, autoComplete, minLength }) {
    return <div className="field">
        <label>{label}</label>
        <input type={type} required={required} minLength={minLength} autoComplete={autoComplete} value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </div>;
}

export default App;
