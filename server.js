// server.js - ZModyfikowany dla streamingu
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer'; 
import fs from 'fs'; 

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Błąd: Nie znaleziono klucza GEMINI_API_KEY. Sprawdź plik .env.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
const chatSessions = new Map();

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

// === NOWY ENDPOINT DLA STREAMINGU ===
app.post('/api/chat', upload.single('file'), async (req, res) => {
    const { message, sessionId } = req.body;
    const file = req.file;

    if (!sessionId) {
        if (file) fs.unlinkSync(file.path);
        return res.status(400).send({ error: 'Brak ID sesji.' });
    }
    if (!message && !file) {
        if (file) fs.unlinkSync(file.path);
        return res.status(400).send({ error: 'Brak wiadomości lub pliku.' });
    }

    try {
        let chat = chatSessions.get(sessionId);
        if (!chat) {
            chat = ai.chats.create({ model: 'gemini-2.5-flash' });
            chatSessions.set(sessionId, chat);
        }

        const contents = [];
        if (file) {
            contents.push(fileToGenerativePart(file.path, file.mimetype));
        }
        if (message && message.trim() !== '') {
            contents.push(message);
        } else if (file) {
            contents.push("Przeanalizuj ten obraz i opisz go szczegółowo.");
        }

        // Ustawienie nagłówków dla streamingu
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.write('START_STREAMING'); // Specjalny znacznik startu

        const responseStream = await chat.sendMessageStream({ message: contents });
        
        // Przesyłanie każdego fragmentu tekstu do klienta
        for await (const chunk of responseStream) {
            res.write(chunk.text);
        }

        res.end(); // Zakończenie odpowiedzi
        
    } catch (error) {
        console.error('Błąd wywołania Gemini API (Streaming):', error);
        res.status(500).end('ERROR_STREAMING'); // Wysłanie znacznika błędu
    } finally {
        if (file) {
            fs.unlinkSync(file.path);
        }
    }
});

// Endpoint do usuwania historii (bez zmian)
app.post('/api/delete-history', (req, res) => {
    const { sessionId } = req.body;
    if (chatSessions.has(sessionId)) {
        chatSessions.delete(sessionId);
        return res.json({ success: true, message: "Historia czatu została usunięta." });
    }
    res.json({ success: true, message: "Brak aktywnej historii do usunięcia." });
});


app.listen(port, () => {
    console.log(`Serwer API działa na porcie http://localhost:${port}`);
});