// index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conectar ao MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// --- Modelos do Banco de Dados (Schemas) ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  birthDate: { type: Date, required: true },
});
const User = mongoose.model('User', UserSchema);

const EventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventName: { type: String, required: true },
  venue: { type: String, required: true },
  dateTime: { type: Date, required: true },
});
const Event = mongoose.model('Event', EventSchema);

// --- ROTAS DE UTILIZADOR ---

// Rota de Registo de Utilizador
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, birthDate } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email já está em uso.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ name, email, password: hashedPassword, birthDate });
    await newUser.save();
    res.status(201).json({ message: 'Utilizador criado com sucesso!' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// Rota de Login
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }
        res.status(200).json({
            id: user._id,
            name: user.name,
            email: user.email
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});

// Rota para verificar identidade (email + data de nascimento)
app.post('/api/users/verify-identity', async (req, res) => {
    try {
        const { email, birthDate } = req.body;
        const user = await User.findOne({ email, birthDate: new Date(birthDate) });
        if (!user) {
            return res.status(404).json({ message: 'Dados não encontrados.' });
        }
        res.status(200).json({ userId: user._id });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});

// Rota para redefinir a senha
app.post('/api/users/reset-password', async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        const updatedUser = await User.findByIdAndUpdate(userId, { password: hashedPassword });
        if (!updatedUser) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});

// Rota para um utilizador apagar a sua própria conta
app.delete('/api/users/me/:id', async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Senha incorreta.' });
        }
        await Event.deleteMany({ userId: userId });
        await User.findByIdAndDelete(userId);
        res.status(200).json({ message: 'Conta apagada com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});


// --- ROTAS DE EVENTOS ---
app.post('/api/events', async (req, res) => {
    try {
        const { userId, eventName, venue, dateTime } = req.body;
        const newEvent = new Event({ userId, eventName, venue, dateTime });
        await newEvent.save();
        res.status(201).json(newEvent);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar evento', error: error.message });
    }
});

app.get('/api/events/:userId', async (req, res) => {
    try {
        const events = await Event.find({ userId: req.params.userId }).sort({ dateTime: 'asc' });
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao obter eventos', error: error.message });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    try {
        const deletedEvent = await Event.findByIdAndDelete(req.params.id);
        if (!deletedEvent) {
            return res.status(404).json({ message: 'Evento não encontrado.' });
        }
        res.status(200).json({ message: 'Evento apagado com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao apagar evento', error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});
