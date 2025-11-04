// Конфигурация Firebase - нужно заменить на вашу!
const firebaseConfig = {
  apiKey: "AIzaSyCxX5J41qh1s1DvErx66P87Fy8wUTPO6F8",
  authDomain: "pixxelie.firebaseapp.com",
  databaseURL: "https://pixxelie-default-rtdb.firebaseio.com",
  projectId: "pixxelie",
  storageBucket: "pixxelie.firebasestorage.app",
  messagingSenderId: "518065921765",
  appId: "1:518065921765:web:e920ab874e0f762b3d7e0c"
};


// Инициализация Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
}
const database = firebase.database();

// Глобальные переменные
let currentUser = null;
let isAdmin = false;
let selectedPixel = null;

// Элементы DOM
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const adminPanel = document.getElementById('adminPanel');
const questionModal = document.getElementById('questionModal');
const usernameInput = document.getElementById('usernameInput');
const joinButton = document.getElementById('joinButton');
const pixelGrid = document.getElementById('pixelGrid');
const playersList = document.getElementById('playersList');
const scoreList = document.getElementById('scoreList');
const questionText = document.getElementById('questionText');
const answerInput = document.getElementById('answerInput');
const submitAnswer = document.getElementById('submitAnswer');
const cancelAnswer = document.getElementById('cancelAnswer');
const closeAdmin = document.getElementById('closeAdmin');

// Инициализация игры
function initGame() {
    console.log("Game initializing...");
    createPixelGrid();
    setupEventListeners();
    
    // Проверяем подключение к Firebase
    database.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            console.log("Connected to Firebase");
            showNotification("Подключено к игре", "success");
        } else {
            console.log("Disconnected from Firebase");
            showNotification("Потеряно соединение", "error");
        }
    });
}

// Создание игрового поля
function createPixelGrid() {
    pixelGrid.innerHTML = '';
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            const pixel = document.createElement('div');
            pixel.className = 'pixel';
            pixel.dataset.x = x;
            pixel.dataset.y = y;
            
            // Добавляем обработчики для десктопа и мобильных
            pixel.addEventListener('click', () => handlePixelClick(x, y));
            pixel.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handlePixelClick(x, y);
            });
            
            pixelGrid.appendChild(pixel);
        }
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    joinButton.addEventListener('click', joinGame);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    
    submitAnswer.addEventListener('click', submitAnswerHandler);
    cancelAnswer.addEventListener('click', () => {
        questionModal.classList.add('hidden');
        selectedPixel = null;
    });
    closeAdmin.addEventListener('click', () => adminPanel.classList.add('hidden'));
    
    // Закрытие модальных окон по клику вне области
    document.addEventListener('click', (e) => {
        if (e.target === questionModal) {
            questionModal.classList.add('hidden');
            selectedPixel = null;
        }
        if (e.target === adminPanel) {
            adminPanel.classList.add('hidden');
        }
    });
}

// Подключение к игре
function joinGame() {
    const username = usernameInput.value.trim();
    console.log("Join game attempt with username:", username);
    
    if (!username) {
        showNotification("Введите ник!", "error");
        return;
    }

    currentUser = {
        id: generateId(),
        username: username,
        score: 0,
        isAdmin: username === 'админ123'
    };

    isAdmin = currentUser.isAdmin;
    console.log("User created:", currentUser);

    // Показываем игровой экран
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    // Если админ - показываем панель
    if (isAdmin) {
        setTimeout(() => {
            adminPanel.classList.remove('hidden');
            setupAdminPanel();
            showNotification("Панель администратора активирована", "success");
        }, 500);
    }

    // Добавляем пользователя в базу данных
    database.ref('users/' + currentUser.id).set({
        username: currentUser.username,
        score: currentUser.score,
        isAdmin: currentUser.isAdmin,
        lastActive: Date.now()
    }).then(() => {
        console.log("User saved to database");
        setupRealtimeListeners();
        showNotification("Добро пожаловать в игру!", "success");
    }).catch(error => {
        console.error("Error saving user:", error);
        showNotification("Ошибка подключения к базе данных", "error");
    });
}

// Обработка клика по пикселю
function handlePixelClick(x, y) {
    console.log("Pixel clicked:", x, y, "Admin:", isAdmin);
    
    if (isAdmin) {
        openAdminPixelEditor(x, y);
    } else {
        const pixelKey = `${x}-${y}`;
        database.ref('pixels/' + pixelKey).once('value').then(snapshot => {
            const pixelData = snapshot.val();
            if (pixelData && pixelData.answered) {
                showNotification("Этот пиксель уже занят!", "error");
            } else if (pixelData && pixelData.question) {
                selectedPixel = { x, y };
                showQuestion(pixelData.question);
            } else {
                showNotification("Для этого пикселя нет вопроса!", "error");
            }
        }).catch(error => {
            console.error("Error reading pixel data:", error);
            showNotification("Ошибка загрузки вопроса", "error");
        });
    }
}

// Показать вопрос
function showQuestion(question) {
    questionText.textContent = question;
    answerInput.value = '';
    questionModal.classList.remove('hidden');
    answerInput.focus();
}

// Обработка ответа
function submitAnswerHandler() {
    const userAnswer = answerInput.value.trim().toLowerCase();
    if (!userAnswer) {
        showNotification("Введите ответ!", "error");
        return;
    }

    const pixelKey = `${selectedPixel.x}-${selectedPixel.y}`;
    
    database.ref('pixels/' + pixelKey).once('value').then(snapshot => {
        const pixelData = snapshot.val();
        if (pixelData && userAnswer === pixelData.answer.toLowerCase()) {
            // Правильный ответ
            database.ref('pixels/' + pixelKey).update({
                answered: true,
                answeredBy: currentUser.username,
                answeredAt: Date.now()
            });

            // Обновляем счет пользователя
            const newScore = currentUser.score + 1;
            currentUser.score = newScore;
            database.ref('users/' + currentUser.id).update({
                score: newScore
            });

            showNotification("Правильный ответ! +1 балл", "success");
            questionModal.classList.add('hidden');
            selectedPixel = null;
        } else {
            showNotification("Неправильный ответ! Попробуйте еще раз.", "error");
            answerInput.value = '';
            answerInput.focus();
        }
    }).catch(error => {
        console.error("Error checking answer:", error);
        showNotification("Ошибка при проверке ответа", "error");
    });
}

// Показать уведомление (вместо alert)
function showNotification(message, type = "success") {
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type === 'error' ? 'error' : ''}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Автоматическое скрытие через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Настройка панели администратора
function setupAdminPanel() {
    const saveQuestionBtn = document.getElementById('saveQuestion');
    const deleteQuestionBtn = document.getElementById('deleteQuestion');
    const resetPlayersBtn = document.getElementById('resetPlayers');
    
    saveQuestionBtn.addEventListener('click', saveQuestion);
    deleteQuestionBtn.addEventListener('click', deleteQuestion);
    resetPlayersBtn.addEventListener('click', resetPlayersList);
    
    loadQuestionsList();
}

// Сброс списка игроков
function resetPlayersList() {
    if (!confirm("Вы уверены, что хотите сбросить список игроков? Все игроки будут удалены, а их счета обнулятся.")) {
        return;
    }
    
    database.ref('users').once('value').then(snapshot => {
        const updates = {};
        
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            if (!user.isAdmin) {
                // Удаляем обычных игроков
                updates[childSnapshot.key] = null;
            } else {
                // Админам сбрасываем счет, но не удаляем
                updates[childSnapshot.key] = {
                    ...user,
                    score: 0
                };
            }
        });
        
        return database.ref('users').update(updates);
    }).then(() => {
        showNotification("Список игроков сброшен!", "success");
        
        // Также сбрасываем все ответы на пикселях
        return database.ref('pixels').once('value');
    }).then(snapshot => {
        const updates = {};
        
        snapshot.forEach(childSnapshot => {
            const pixelData = childSnapshot.val();
            if (pixelData.answered) {
                updates[childSnapshot.key] = {
                    ...pixelData,
                    answered: false,
                    answeredBy: null,
                    answeredAt: null
                };
            }
        });
        
        if (Object.keys(updates).length > 0) {
            return database.ref('pixels').update(updates);
        }
    }).then(() => {
        showNotification("Все пиксели разблокированы!", "success");
    }).catch(error => {
        console.error("Error resetting players:", error);
        showNotification("Ошибка при сбросе игроков", "error");
    });
}

// Сохранение вопроса
function saveQuestion() {
    const x = parseInt(document.getElementById('adminX').value);
    const y = parseInt(document.getElementById('adminY').value);
    const question = document.getElementById('adminQuestion').value;
    const answer = document.getElementById('adminAnswer').value;
    const color = document.getElementById('adminColor').value;

    if (isNaN(x) || isNaN(y) || x < 0 || x > 9 || y < 0 || y > 9) {
        showNotification("Введите корректные координаты (0-9)", "error");
        return;
    }

    if (!question || !answer) {
        showNotification("Заполните вопрос и ответ", "error");
        return;
    }

    const pixelKey = `${x}-${y}`;
    database.ref('pixels/' + pixelKey).set({
        question: question,
        answer: answer.toLowerCase(),
        color: color,
        answered: false,
        createdBy: currentUser.username,
        createdAt: Date.now()
    }).then(() => {
        showNotification("Вопрос сохранен!", "success");
        clearAdminForm();
        loadQuestionsList();
    }).catch(error => {
        console.error("Error saving question:", error);
        showNotification("Ошибка сохранения вопроса", "error");
    });
}

// Удаление вопроса
function deleteQuestion() {
    const x = parseInt(document.getElementById('adminX').value);
    const y = parseInt(document.getElementById('adminY').value);

    if (isNaN(x) || isNaN(y)) {
        showNotification("Введите координаты пикселя", "error");
        return;
    }

    const pixelKey = `${x}-${y}`;
    database.ref('pixels/' + pixelKey).remove().then(() => {
        showNotification("Вопрос удален!", "success");
        clearAdminForm();
        loadQuestionsList();
    }).catch(error => {
        console.error("Error deleting question:", error);
        showNotification("Ошибка удаления вопроса", "error");
    });
}

// Загрузка списка вопросов
function loadQuestionsList() {
    database.ref('pixels').once('value').then(snapshot => {
        const questionsList = document.getElementById('questionsList');
        questionsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            questionsList.innerHTML = '<div>Вопросов пока нет</div>';
            return;
        }
        
        snapshot.forEach(childSnapshot => {
            const pixelData = childSnapshot.val();
            const [x, y] = childSnapshot.key.split('-');
            
            const questionItem = document.createElement('div');
            questionItem.className = 'question-item';
            questionItem.innerHTML = `
                <h5>Пиксель (${x}, ${y})</h5>
                <div><strong>Вопрос:</strong> ${pixelData.question}</div>
                <div><strong>Ответ:</strong> ${pixelData.answer}</div>
                <div class="question-info">
                    Цвет: <span style="color: ${pixelData.color}">${pixelData.color}</span> | 
                    ${pixelData.answered ? 'Отвечен' : 'Свободен'}
                </div>
            `;
            
            questionItem.addEventListener('click', () => {
                document.getElementById('adminX').value = x;
                document.getElementById('adminY').value = y;
                document.getElementById('adminQuestion').value = pixelData.question;
                document.getElementById('adminAnswer').value = pixelData.answer;
                document.getElementById('adminColor').value = pixelData.color;
            });
            
            questionsList.appendChild(questionItem);
        });
    });
}

// Очистка формы админа
function clearAdminForm() {
    document.getElementById('adminX').value = '';
    document.getElementById('adminY').value = '';
    document.getElementById('adminQuestion').value = '';
    document.getElementById('adminAnswer').value = '';
    document.getElementById('adminColor').value = '#ff0000';
}

// Открытие редактора пикселей для админа
function openAdminPixelEditor(x, y) {
    document.getElementById('adminX').value = x;
    document.getElementById('adminY').value = y;
    
    const pixelKey = `${x}-${y}`;
    database.ref('pixels/' + pixelKey).once('value').then(snapshot => {
        const pixelData = snapshot.val();
        if (pixelData) {
            document.getElementById('adminQuestion').value = pixelData.question || '';
            document.getElementById('adminAnswer').value = pixelData.answer || '';
            document.getElementById('adminColor').value = pixelData.color || '#ff0000';
        } else {
            document.getElementById('adminQuestion').value = '';
            document.getElementById('adminAnswer').value = '';
            document.getElementById('adminColor').value = '#ff0000';
        }
    });
}

// Настройка реального времени
function setupRealtimeListeners() {
    // Слушаем изменения пикселей
    database.ref('pixels').on('value', (snapshot) => {
        console.log("Pixels updated:", snapshot.val());
        updatePixelGrid(snapshot.val());
    });

    // Слушаем изменения пользователей
    database.ref('users').on('value', (snapshot) => {
        console.log("Users updated:", snapshot.val());
        updatePlayersList(snapshot.val());
    });
}

// Обновление игрового поля
function updatePixelGrid(pixels) {
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            const pixelKey = `${x}-${y}`;
            const pixelElement = document.querySelector(`.pixel[data-x="${x}"][data-y="${y}"]`);
            
            if (pixels && pixels[pixelKey]) {
                const pixelData = pixels[pixelKey];
                if (pixelData.answered) {
                    pixelElement.style.backgroundColor = pixelData.color;
                    pixelElement.classList.add('answered');
                    pixelElement.title = `Отвечен: ${pixelData.answeredBy}`;
                } else {
                    pixelElement.style.backgroundColor = '#ecf0f1';
                    pixelElement.classList.remove('answered');
                    pixelElement.title = pixelData.question || 'Нет вопроса';
                }
            } else {
                pixelElement.style.backgroundColor = '#ecf0f1';
                pixelElement.classList.remove('answered');
                pixelElement.title = 'Нет вопроса';
            }
        }
    }
}

// Обновление списка игроков
function updatePlayersList(users) {
    if (!users) {
        playersList.innerHTML = '<div class="player-item">Нет игроков онлайн</div>';
        scoreList.innerHTML = '<div class="score-item">Нет данных</div>';
        return;
    }

    playersList.innerHTML = '';
    scoreList.innerHTML = '';

    const playersArray = [];
    const scoreArray = [];

    Object.values(users).forEach(user => {
        if (!user.isAdmin) {
            playersArray.push(user);
            scoreArray.push(user);
        }
    });

    // Сортируем по очкам
    scoreArray.sort((a, b) => b.score - a.score);

    // Обновляем онлайн игроков
    if (playersArray.length === 0) {
        playersList.innerHTML = '<div class="player-item">Нет игроков онлайн</div>';
    } else {
        playersArray.forEach(user => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.textContent = `${user.username} (${user.score})`;
            playersList.appendChild(playerElement);
        });
    }

    // Обновляем таблицу лидеров
    if (scoreArray.length === 0) {
        scoreList.innerHTML = '<div class="score-item">Нет игроков</div>';
    } else {
        scoreArray.forEach((user, index) => {
            const scoreElement = document.createElement('div');
            scoreElement.className = 'score-item';
            scoreElement.innerHTML = `
                <span>${index + 1}. ${user.username}</span>
                <span>${user.score} баллов</span>
            `;
            scoreList.appendChild(scoreElement);
        });
    }
}

// Вспомогательные функции
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initGame);

// Очистка при закрытии страницы
window.addEventListener('beforeunload', () => {
    if (currentUser && !currentUser.isAdmin) {
        database.ref('users/' + currentUser.id).remove();
    }
});
        
