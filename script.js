// script.js - WERSJA OSTATECZNA ZE STREAMINGIEM
document.addEventListener('DOMContentLoaded', () => {
    const chatsContainer = document.querySelector(".chats-container");
    const promptForm = document.querySelector(".prompt-form");
    const promptInput = document.querySelector(".prompt-input");
    const suggestionsList = document.querySelector(".suggestions");
    const deleteChatsBtn = document.getElementById("delete-chats-btn");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const addFileBtn = document.getElementById("add-file-btn");

    const API_URL = 'http://localhost:3000/api/chat'; 
    const DELETE_URL = 'http://localhost:3000/api/delete-history';

    let sessionId = localStorage.getItem('sessionId') || `session-${Date.now()}`;
    localStorage.setItem('sessionId', sessionId);
    
    let attachedFile = null; 

    // --- FUNKCJE POMOCNICZE ---

    // Funkcja do konwersji Markdown na HTML
    function convertMarkdownToHtml(markdown) {
        if (!markdown) return '';
        let html = markdown;

        // 1. Bloki kodu
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => 
            `<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
            
        // 2. Kod inline 
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 3. Nagłówki H3 
        html = html.replace(/\n### (.*)/g, '\n<h3>$1</h3>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<h3>$1</h3>'); 
        
        // 4. Listy Punktowane
        html = html.replace(/(\n[*-]\s+.*)+/g, (match) => {
            let listHtml = '<ul>';
            match.trim().split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.match(/^[*-]\s+/)) {
                    // Usuń potencjalne znaczniki Markdown z li
                    const listItemText = trimmedLine.substring(2).trim(); 
                    listHtml += `<li>${listItemText}</li>`;
                }
            });
            return listHtml + '</ul>';
        });

        // 5. Listy Numerowane
        html = html.replace(/(\n\d+\.\s+.*)+/g, (match) => {
            let listHtml = '<ol>';
            match.trim().split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.match(/^\d+\.\s+/)) {
                    const listItemText = trimmedLine.replace(/^\d+\.\s+/, '').trim();
                    listHtml += `<li>${listItemText}</li>`;
                }
            });
            return listHtml + '</ol>';
        });
        
        // 6. Akapity (owinięcie linii tekstu, które nie są listami/kodem w <p>)
        html = html.split('\n').map(line => {
            const trimmed = line.trim();
            // Sprawdź, czy linia jest pusta LUB zaczyna się od znacznika, który już obsłużyliśmy
            if (trimmed === '' || trimmed.match(/^(<pre|<ul|<ol|<h3)/) || line.includes('</')) {
                return line;
            }
            return `<p>${line}</p>`;
        }).join('');

        // Usuń puste akapity
        html = html.replace(/<p>\s*<\/p>/g, '');

        return html;
    }


    const createMsgElement = (content, ...classes) => {
        const div = document.createElement("div");
        div.classList.add("message", ...classes);
        div.innerHTML = content;
        return div;
    };

    const scrollToBottom = () => {
        chatsContainer.scrollTop = chatsContainer.scrollHeight;
    };

    const toggleInitialContent = (showChat) => {
        const header = document.querySelector(".app-header");
        const suggestions = document.querySelector(".suggestions");
        const hasMessages = chatsContainer.children.length > 0;
        
        if (showChat || hasMessages) {
            header.style.display = 'none';
            suggestions.style.display = 'none';
        } else {
            header.style.display = 'block';
            suggestions.style.display = 'flex';
        }
    };
    
    const initTheme = () => {
        const isLight = localStorage.getItem('theme') === 'light';
        document.body.classList.toggle('light-mode', isLight);
        themeToggleBtn.textContent = isLight ? 'dark_mode' : 'light_mode';
    };

    // --- NOWA FUNKCJA GENERATERESPONSE Z OBSŁUGĄ STREAMINGU ---
    const generateResponse = async (userMessage, file) => {
        const loadingDiv = chatsContainer.querySelector(".bot-message.loading");
        const messageTextElement = loadingDiv.querySelector(".message-text");
        
        // Wyczyść tekst ładowania, aby zacząć wyświetlać streamowany tekst
        messageTextElement.textContent = "";
        
        try {
            const formData = new FormData();
            formData.append('sessionId', sessionId);
            formData.append('message', userMessage || ' '); 
            if (file) {
                formData.append('file', file);
            }

            const response = await fetch(API_URL, {
                method: "POST",
                body: formData, 
            });

            if (!response.ok) {
                throw new Error(`Błąd HTTP: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = '';
            
            // Pętla do odczytywania fragmentów ze strumienia
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                // Ignoruj znacznik startu streamingu z serwera
                if (buffer.startsWith('START_STREAMING')) {
                    buffer = buffer.substring('START_STREAMING'.length);
                }
                
                // Sprawdzenie znacznika błędu
                if (buffer.includes('ERROR_STREAMING')) {
                     throw new Error("Błąd podczas przesyłania danych ze strony serwera.");
                }

                // Aktualizuj DOM po każdym otrzymanym kawałku
                messageTextElement.innerHTML = convertMarkdownToHtml(buffer);
                scrollToBottom();
            }
            
            // Finalne parsowanie po otrzymaniu wszystkich danych
            messageTextElement.innerHTML = convertMarkdownToHtml(buffer);

            if (loadingDiv) {
                loadingDiv.classList.remove("loading");
            }
            
        } catch (err) {
            console.error("Wystąpił błąd podczas streamingu:", err);
            const errorMsg = "Błąd: Nie udało się uzyskać odpowiedzi. Sprawdź konsolę serwera Node.js i klucz API.";
            if (loadingDiv) {
                loadingDiv.classList.remove("loading");
                loadingDiv.innerHTML = `<span class="material-symbols-rounded avatar" style="background-color: #ff4d4d;"> error </span><div class="message-text" style="color: #ff4d4d; padding: 12px 16px;">${errorMsg}</div>`;
            }
        } finally {
            scrollToBottom();
            attachedFile = null; 
            addFileBtn.style.color = 'var(--text-color)';
            promptInput.placeholder = "Zapytaj Smygrys GPT"; 
        }
    };


    // --- OBSŁUGA ZDARZEŃ ---

    function handleFormSubmit(e) {
        e.preventDefault();
        const userMessage = promptInput.value.trim();
        
        if (!userMessage && !attachedFile) return;

        promptInput.value = "";
        toggleInitialContent(true); 

        // 1. Dodaj wiadomość użytkownika (z tekstem i/lub obrazem)
        let content;
        if (attachedFile) {
            const imgUrl = URL.createObjectURL(attachedFile);
            const textContent = userMessage || 'Analizuję obraz...';
            content = `<img src="${imgUrl}" alt="Załączony obrazek"><p class="message-text">${textContent}</p>`;
        } else {
             content = `<p class="message-text">${userMessage}</p>`;
        }
        
        const userMsgDiv = createMsgElement(content, "user-message");
        chatsContainer.appendChild(userMsgDiv);
        scrollToBottom();

        // 2. Dodaj wiadomość ładowania bota
        const botMsgHTML = `<span class="material-symbols-rounded avatar"> auto_awesome </span><div class="message-text">Generowanie odpowiedzi...</div>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading"); 
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        
        // 3. Natychmiastowe wywołanie API
        generateResponse(userMessage, attachedFile);
    }

    promptForm.addEventListener("submit", handleFormSubmit);
    
    // Obsługa kliknięcia sugestii
    suggestionsList.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestions-item');
        
        if (suggestionItem) {
            const textElement = suggestionItem.querySelector('.text');
            
            if (textElement) {
                const text = textElement.textContent.trim();
                
                promptInput.value = text;
                promptForm.dispatchEvent(new Event('submit'));
            }
        }
    });


    // Przełączanie Motywu
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeToggleBtn.textContent = isLight ? 'dark_mode' : 'light_mode';
    });
    
    // Obsługa załączania pliku
    addFileBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*'; 
        fileInput.hidden = true;
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                attachedFile = file;
                addFileBtn.style.color = 'var(--accent-color)'; 
                promptInput.placeholder = `Plik: ${file.name} | Zadaj pytanie o obraz...`;
            }
        };
        fileInput.click();
    });
    
    // Obsługa usuwania czatu
    deleteChatsBtn.addEventListener('click', async () => {
        if (chatsContainer.children.length === 0) return;

        chatsContainer.innerHTML = '';
        attachedFile = null;
        promptInput.placeholder = "Zapytaj Smygrys GPT";
        addFileBtn.style.color = 'var(--text-color)';
        toggleInitialContent(false);

        try {
            await fetch(DELETE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sessionId }),
            });
            sessionId = `session-${Date.now()}`;
            localStorage.setItem('sessionId', sessionId);
        } catch (err) {
            console.error("Błąd podczas usuwania historii:", err);
        }
    });

    // Uruchomienie motywu przy starcie
    initTheme();
    
    // Inicjalizacja widoku
    if (chatsContainer.children.length === 0) {
        toggleInitialContent(false);
    }
});