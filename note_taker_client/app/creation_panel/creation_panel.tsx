import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import styles from './creation_panel.module.css'

const HIGHLIGHT_RE = /(<[^>\n]+>)/g;

function renderWithHighlights(text: string) {
    const parts = text.split(HIGHLIGHT_RE);
    return parts.map((part, i) =>
        /^<[^>\n]+>$/.test(part)
            ? <span key={i} className={styles.marker}>{part}</span>
            : part
    );
}
interface Note {
    id: number;
    title: string;
    content: string;
    createdAtMs: number;
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';
const SAVE_DEBOUNCE_MS = 400;
const THEME_KEY = 'note_taker.theme';

export default function CreationPanel() {

    const navigate = useNavigate();
    const { noteId: urlNoteId } = useParams<{ noteId?: string }>();
    const noteId = urlNoteId !== undefined && /^\d+$/.test(urlNoteId) ? Number(urlNoteId) : null;

    const [notes, setNotes] = useState<Note[]>([]);
    const [noteGroups, setNoteGroups] = useState<[string, Note[]][]>([]);
    const [notesLoaded, setNotesLoaded] = useState(false);

    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const highlightRef = useRef<HTMLPreElement>(null);
    const saveTimerRef = useRef<number | null>(null);
    const pendingSaveRef = useRef<{ id: number | null; title: string; content: string } | null>(null);
    const initializedForRef = useRef<number | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/notes`)
            .then(r => r.json())
            .then((data: Note[]) => {
                setNotes(data);
                setNotesLoaded(true);
            })
            .catch(err => {
                console.error('Failed to load notes', err);
                setNotesLoaded(true);
            });
    }, []);

    useEffect(() => {
        if (!notesLoaded) return;
        if (urlNoteId === undefined) return;
        if (noteId === null || !notes.some(n => n.id === noteId)) {
            navigate('/', { replace: true });
        }
    }, [notesLoaded, urlNoteId, noteId, notes, navigate]);

    useEffect(() => {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') {
            setTheme(stored);
            return;
        }
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    useEffect(() => {
        const groups = new Map<string, Note[]>();
        for (const note of notes) {
            const key = new Date(note.createdAtMs).toLocaleDateString();
            const arr = groups.get(key) ?? [];
            arr.push(note);
            groups.set(key, arr);
        }
        setNoteGroups(Array.from(groups.entries()));
    }, [notes]);

    async function persistNote(id: number | null, nextTitle: string, nextContent: string) {
        if (id !== null) {
            const res = await fetch(`${API_BASE}/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: nextTitle, content: nextContent }),
            });
            if (!res.ok) return;
            const updated: Note = await res.json();
            setNotes(prev => prev.map(n => n.id === id ? updated : n));
            return;
        }
        if (nextTitle.trim().length === 0 && nextContent.trim().length === 0) return;
        const res = await fetch(`${API_BASE}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: nextTitle, content: nextContent }),
        });
        if (!res.ok) return;
        const created: Note = await res.json();
        initializedForRef.current = created.id;
        setNotes(prev => [...prev, created]);
        navigate(`/${created.id}`, { replace: true });
    }

    function scheduleSave(id: number | null, nextTitle: string, nextContent: string) {
        pendingSaveRef.current = { id, title: nextTitle, content: nextContent };
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = null;
            const pending = pendingSaveRef.current;
            pendingSaveRef.current = null;
            if (pending) {
                persistNote(pending.id, pending.title, pending.content);
            }
        }, SAVE_DEBOUNCE_MS);
    }

    async function flushPendingSave() {
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (pending) {
            await persistNote(pending.id, pending.title, pending.content);
        }
    }

    function onTitleChange(value: string) {
        setTitle(value);
        scheduleSave(noteId, value, content);
    }

    function onContentChange(value: string) {
        setContent(value);
        scheduleSave(noteId, title, value);
    }

    async function newNote() {
        await flushPendingSave();
        setTitle('');
        setContent('');
        initializedForRef.current = null;
        navigate('/');
    }

    async function selectNote(id: number) {
        await flushPendingSave();
        navigate(`/${id}`);
    }

    async function deleteNote(id: number) {
        if (saveTimerRef.current !== null && pendingSaveRef.current?.id === id) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
            pendingSaveRef.current = null;
        }
        const res = await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) return;
        setNotes(prev => prev.filter(n => n.id !== id));
        if (id === noteId) {
            setTitle('');
            setContent('');
            initializedForRef.current = null;
            navigate('/');
        }
    }

    function toggleTheme() {
        setTheme(theme === 'light' ? 'dark' : 'light');
    }

    useEffect(() => {
        if (noteId === null) {
            initializedForRef.current = null;
            return;
        }
        if (initializedForRef.current === noteId) return;
        const selected = notes.find(n => n.id === noteId);
        if (!selected) return;
        setTitle(selected.title);
        setContent(selected.content);
        initializedForRef.current = noteId;
    }, [noteId, notes]);

    return (
        <div className={styles.panel} data-theme={theme}>
            <div className={styles.sidePanel}>
                <div className={styles.titleBar}>
                    <h2 className={styles.titleCase}>Notes</h2>
                    <div className={styles.actionButtons}>
                        <button onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                            <span className="material-symbols-outlined">
                                {theme === 'light' ? 'dark_mode' : 'light_mode'}
                            </span>
                        </button>
                    </div>
                </div>
                <ul className={styles.history}>
                    {noteGroups.map(([date, group]) => (
                        <li key={date} className={styles.historyGroup}>
                            <div className={styles.historyDate}>{date}</div>
                            <ul className={styles.historyGroupList}>
                                {group.map(({ id, title }) => (
                                    <li key={id} className={styles.historyItem} data-selected={id === noteId} role="button"
                                        onClick={() => selectNote(id)}
                                    >
                                        <span className={styles.historyItemTitle}>{title.length > 0 ? title : "<empty title>"}</span>
                                        <button className={styles.deleteButton} aria-label="Delete note"
                                            onClick={(e) => { e.stopPropagation(); deleteNote(id); }}
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            </div>
            <div className={styles.editor}>
                <div className={styles.titleBar}>
                    <input type="text" id="title" placeholder="Title" className={`${styles.editorTitleInput} ${styles.titleCase}`}
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                    />
                    <div className={styles.actionButtons}>
                        <button onClick={newNote} aria-label="New">
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>
                </div>
                <div className={styles.editorStack}>
                    <pre ref={highlightRef} className={styles.highlightLayer} aria-hidden="true">
                        {renderWithHighlights(content)}
                        {content.endsWith('\n') && '\n'}
                    </pre>
                    <textarea id="content" placeholder="Start Writing..." className={styles.inputLayer} value={content}
                        onChange={(e) => onContentChange(e.target.value)}
                        onScroll={(e) => {
                            if (highlightRef.current) {
                                highlightRef.current.scrollTop = e.currentTarget.scrollTop;
                                highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
                            }
                        }}
                    />
                </div>
            </div>
        </div >
    )
};
