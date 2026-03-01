require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve frontend files


// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tasksphere')
    .then(() => {
        console.log('MongoDB Connected');
        // Drop tasks collection — tasks are stored in localStorage, not MongoDB
        mongoose.connection.db.dropCollection('tasks')
            .then(() => console.log('tasks collection dropped'))
            .catch(() => { }); // Silently ignore if collection doesn't exist
    })
    .catch(err => console.log('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);



// Middleware to verify JWT
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ msg: 'Token is not valid' });
    }
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ msg: 'Please enter all fields' });

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) return res.status(400).json({ msg: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, email, password: hashedPassword });
        const savedUser = await newUser.save();

        // 🔔 Log new signup
        console.log(`\n🆕 NEW SIGNUP at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
        console.log(`   👤 Username : ${savedUser.username}`);
        console.log(`   📧 Email    : ${savedUser.email}`);
        console.log(`   🆔 User ID  : ${savedUser._id}`);

        const token = jwt.sign({ id: savedUser._id, username: savedUser.username, email: savedUser.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: { id: savedUser._id, username: savedUser.username, email: savedUser.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ msg: 'Please enter all fields' });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'User does not exist' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`\n❌ FAILED LOGIN at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST - Wrong password for: ${email}`);
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // 🔔 Log successful login
        console.log(`\n✅ USER LOGGED IN at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
        console.log(`   👤 Username : ${user.username}`);
        console.log(`   📧 Email    : ${user.email}`);
        console.log(`   🆔 User ID  : ${user._id}`);

        const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: { id: user._id, username: user.username, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
