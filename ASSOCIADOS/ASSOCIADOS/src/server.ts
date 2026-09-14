import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { ExcelService } from './services/excelService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories
const uploadsDir = path.join(process.cwd(), 'uploads');
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Setup multer for spreadsheet upload
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Keep original name or save as Controle - Associados - 2026.xlsx
    const ext = path.extname(file.originalname);
    cb(null, `Controle - Associados - 2026${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx ou .xls) são aceitos.'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// Attempt initial load
ExcelService.loadExcel();

// Routes
app.get('/api/status', (_req: Request, res: Response) => {
  const status = ExcelService.getStatus();
  res.json(status);
});

app.get('/api/associados', (req: Request, res: Response) => {
  const { search, status, departamento, cargo, unidade, page = '1', limit = '100' } = req.query;

  const filtered = ExcelService.getAssociados({
    search: search ? String(search) : undefined,
    status: status ? String(status) : undefined,
    departamento: departamento ? String(departamento) : undefined,
    cargo: cargo ? String(cargo) : undefined,
    unidade: unidade ? String(unidade) : undefined,
  });

  const p = Math.max(1, parseInt(String(page)) || 1);
  const l = Math.max(1, parseInt(String(limit)) || 100);
  const startIndex = (p - 1) * l;
  const paginated = filtered.slice(startIndex, startIndex + l);

  res.json({
    total: filtered.length,
    page: p,
    limit: l,
    totalPages: Math.ceil(filtered.length / l),
    data: paginated
  });
});

app.get('/api/kpis', (req: Request, res: Response) => {
  const { search, status, departamento, cargo, unidade } = req.query;

  const filtered = ExcelService.getAssociados({
    search: search ? String(search) : undefined,
    status: status ? String(status) : undefined,
    departamento: departamento ? String(departamento) : undefined,
    cargo: cargo ? String(cargo) : undefined,
    unidade: unidade ? String(unidade) : undefined,
  });

  const kpis = ExcelService.getKPIs(filtered);
  res.json(kpis);
});

app.get('/api/filters', (_req: Request, res: Response) => {
  const filters = ExcelService.getFilters();
  res.json(filters);
});

app.get('/api/columns', (_req: Request, res: Response) => {
  const cols = ExcelService.getRawColumns();
  res.json({ columns: cols });
});

app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
  }

  const result = ExcelService.loadExcel(req.file.path);
  if (result.success) {
    return res.json({ success: true, message: result.message, count: result.count });
  } else {
    return res.status(500).json({ success: false, message: result.message });
  }
});

app.post('/api/reload', (_req: Request, res: Response) => {
  const result = ExcelService.loadExcel();
  res.json(result);
});

// Fallback to index.html for SPA
app.use((_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Dashboard de Associados iniciado com sucesso!`);
  console.log(`🌐 Acesse no navegador: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});
