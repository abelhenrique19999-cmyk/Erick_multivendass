import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-super-segura-marketing-2026';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Limitação de tentativas de login (Segurança)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas
  message: { error: 'Muitas tentativas incorretas. Tente novamente em 15 minutos.' }
});

// Inicialização e Configuração do Banco de Dados SQLite
let db;
async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Tabela de Configurações
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Tabela de Cursos
  await db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      price REAL,
      image TEXT,
      link TEXT,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Tabela de Depoimentos
  await db.exec(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      role TEXT,
      comment TEXT,
      avatar TEXT
    );
  `);

  // Tabela de FAQ
  await db.exec(`
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      answer TEXT
    );
  `);

  // Tabela de Admin (Guarda a senha hasheada de forma segura)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      password TEXT
    );
  `);

  // Inserir dados padrão se o banco estiver vazio
  const adminExists = await db.get('SELECT * FROM admin WHERE id = 1');
  if (!adminExists) {
    const defaultHash = await bcrypt.hash('1507', 10);
    await db.run('INSERT INTO admin (id, password) VALUES (1, ?)', [defaultHash]);

    // Dados Padrão do Site
    const defaultSettings = {
      brandName: 'EmpowerMark',
      primaryColor: '#8b5cf6',
      accentColor: '#ec4899',
      heroTitle: 'Comece no Marketing Digital e transforme seu conhecimento em oportunidade',
      heroSubtitle: 'O passo a passo prático para iniciantes conquistarem os primeiros resultados no mercado digital.',
      benefitsTitle: 'Por que escolher nossa plataforma?',
      footerText: '© 2026 EmpowerMark. Todos os direitos reservados.'
    };

    for (const [key, val] of Object.entries(defaultSettings)) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, val]);
    }

    // Cursos Padrão
    await db.run(`
      INSERT INTO courses (title, description, price, image, link, active, sort_order) VALUES 
      ('Formação Marketing Digital 360', 'Aprenda tráfego pago, redes sociais e vendas online do absoluto zero.', 197.00, 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600', '#', 1, 1),
      ('Dominando o Tráfego Pago', 'Estratégias de anúncios no Meta Ads e Google Ads para escalar seu negócio.', 97.00, 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600', '#', 1, 2)
    `);

    // Depoimentos Padrão
    await db.run(`
      INSERT INTO testimonials (name, role, comment, avatar) VALUES 
      ('Mariana Costa', 'Empreendedora', 'Consegui realizar minhas primeiras vendas na primeira semana seguindo o método!', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'),
      ('Carlos Eduardo', 'Afiliado', 'A didática dos cursos é impecável. O painel e os materiais são direto ao ponto.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150')
    `);

    // FAQ Padrão
    await db.run(`
      INSERT INTO faqs (question, answer) VALUES 
      ('Preciso de experiência prévia?', 'Não! Nossos cursos foram criados especialmente para iniciantes.'),
      ('Como recebo o acesso?', 'O acesso é imediato após a confirmação do pagamento via e-mail.')
    `);
  }
}

// Middleware de Autenticação JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Sessão expirada ou inválida' });
    req.user = user;
    next();
  });
}

// --- ROTAS DA API ---

// Public Data
app.get('/api/site-data', async (req, res) => {
  try {
    const settingsRows = await db.all('SELECT * FROM settings');
    const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    const courses = await db.all('SELECT * FROM courses WHERE active = 1 ORDER BY sort_order ASC');
    const testimonials = await db.all('SELECT * FROM testimonials');
    const faqs = await db.all('SELECT * FROM faqs');

    res.json({ settings, courses, testimonials, faqs });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Admin Login
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  const admin = await db.get('SELECT * FROM admin WHERE id = 1');
  const validPassword = await bcrypt.compare(password, admin.password);

  if (!validPassword) {
    return res.status(401).json({ error: 'Senha incorreta!' });
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// Admin Full Data (Includes inactive items)
app.get('/api/admin/data', authenticateToken, async (req, res) => {
  const settingsRows = await db.all('SELECT * FROM settings');
  const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  const courses = await db.all('SELECT * FROM courses ORDER BY sort_order ASC');
  const testimonials = await db.all('SELECT * FROM testimonials');
  const faqs = await db.all('SELECT * FROM faqs');

  res.json({ settings, courses, testimonials, faqs });
});

// Salvar Configurações Gerais
app.post('/api/admin/save-settings', authenticateToken, async (req, res) => {
  const settings = req.body;
  for (const [key, value] of Object.entries(settings)) {
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
  res.json({ message: 'Configurações salvas com sucesso!' });
});

// CRUD Cursos
app.post('/api/admin/courses', authenticateToken, async (req, res) => {
  const { id, title, description, price, image, link, active, sort_order } = req.body;
  if (id) {
    await db.run(
      'UPDATE courses SET title=?, description=?, price=?, image=?, link=?, active=?, sort_order=? WHERE id=?',
      [title, description, price, image, link, active ? 1 : 0, sort_order || 0, id]
    );
  } else {
    await db.run(
      'INSERT INTO courses (title, description, price, image, link, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description, price, image, link, active ? 1 : 0, sort_order || 0]
    );
  }
  res.json({ message: 'Curso salvo com sucesso!' });
});

app.delete('/api/admin/courses/:id', authenticateToken, async (req, res) => {
  await db.run('DELETE FROM courses WHERE id = ?', [req.params.id]);
  res.json({ message: 'Curso excluído!' });
});

// Rota para pegar curso único (Página individual)
app.get('/api/courses/:id', async (req, res) => {
  const course = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.status(404).json({ error: 'Curso não encontrado' });
  res.json(course);
});

// Servir Páginas HTML Dinamicamente
app.get('/cursos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cursos.html')));
app.get('/curso/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'curso.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html')));

initDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
});