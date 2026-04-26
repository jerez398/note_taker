import express from 'express';
import cors from 'cors';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listNotes, createNote, updateNote, deleteNote } from './db.js';

const PORT = 3001;
const here = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const api = express.Router()

api.get('/notes', (_req, res) => {
    res.json(listNotes());
});

api.post('/notes', (req, res) => {
    const { title, content } = req.body ?? {};
    if (typeof title !== 'string' || typeof content !== 'string') {
        return res.status(400).json({ error: 'title and content must be strings' });
    }
    res.status(201).json(createNote({ title, content }));
});

api.put('/notes/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'invalid id' });
    }
    const { title, content } = req.body ?? {};
    if (typeof title !== 'string' || typeof content !== 'string') {
        return res.status(400).json({ error: 'title and content must be strings' });
    }
    const note = updateNote(id, { title, content });
    if (!note) return res.status(404).json({ error: 'not found' });
    res.json(note);
});

api.delete('/notes/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'invalid id' });
    }
    if (!deleteNote(id)) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
});

app.use('/api', api);

if (process.env.NODE_ENVIRONMENT === 'production') {
    const clientDir = join(here, '..', '..', 'note_taker_client', 'build', 'client');
    app.use(express.static(clientDir));
    app.get('*', (_req, res) => {
        res.sendFile(join(clientDir, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`note_taker server listening on http://localhost:${PORT}`);
});
