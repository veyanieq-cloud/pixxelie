// Конфигурация Firebase (замените на свою)
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxX5J41qh1s1DvErx66P87Fy8wUTPO6F8",
  authDomain: "pixxelie.firebaseapp.com",
  databaseURL: "https://pixxelie-default-rtdb.firebaseio.com",
  projectId: "pixxelie",
  storageBucket: "pixxelie.firebasestorage.app",
  messagingSenderId: "518065921765",
  appId: "1:518065921765:web:e920ab874e0f762b3d7e0c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
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
    createPixelGrid();
    setupEventListeners();
    loadQuestions();
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
            pixel.addEventListener('click', () => handlePixelClick(x, y));
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
    cancelAnswer.addEventListener('click', () => questionModal.classList.add('hidden'));
    closeAdmin.addEventListener('click', () => adminPanel.classList.add('hidden'));
    
    // Для демонстрации - кнопка админа (в реальном приложении убрать)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'a') {
            isAdmin = true;
            adminPanel.classList.remove('hidden');
        }
    });
}

// Подключение к игре
function joinGame() {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Введите ник!');
        return;
    }

    currentUser = {
        id: generateId(),
        username: username,
        score: 0,
        isAdmin: username === 'админ123'
    };

    isAdmin = currentUser.isAdmin;

    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    if (isAdmin) {
        adminPanel.classList.remove('hidden');
        setupAdminPanel();
    }

    // Добавляем пользователя в базу данных
    database.ref('users/' + currentUser.id).set({
        username: currentUser.username,
        score: currentUser.score,
        isAdmin: currentUser.isAdmin,
        lastActive: Date.now()
    });

    // Слушаем изменения в реальном времени
    setupRealtimeListeners();
}

// Обработка клика по пикселю
function handlePixelClick(x, y) {
    if (isAdmin) {
        // Админ может изменять любые пиксели
        openAdminPixelEditor(x, y);
    } else {
        // Обычный пользователь может отвечать только на свободные пиксели
        const pixelKey = `${x}-${y}`;
        database.ref('pixels/' + pixelKey).once('value').then(snapshot => {
            const pixelData = snapshot.val();
            if (pixelData && pixelData.answered) {
                alert('Этот пиксель уже занят!');
            } else if (pixelData && pixelData.question) {
                selectedPixel = { x, y };
                showQuestion(pixelData.question, pixelData.answer);
            } else {
                alert('Для этого пикселя нет вопроса!');
            }
        });
    }
}

// Показать вопрос
function showQuestion(question, correctAnswer) {
    questionText.textContent = question;
    answerInput.value = '';
    questionModal.classList.remove('hidden');
    answerInput.focus();
}

// Обработка ответа
function submitAnswerHandler() {
    const userAnswer = answerInput.value.trim().toLowerCase();
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

            alert('Правильный ответ!');
            questionModal.classList.add('hidden');
        } else {
            alert('Неправильный ответ! Попробуйте еще раз.');
            answerInput.value = '';
            answerInput.focus();
        }
    });
}

// Настройка панели администратора
function setupAdminPanel() {
    // Здесь будет код для управления вопросами
    const saveQuestionBtn = document.getElementById('saveQuestion');
    const deleteQuestionBtn = document.getElementById('deleteQuestion');
    
    saveQuestionBtn.addEventListener('click', saveQuestion);
    deleteQuestionBtn.addEventListener('click', deleteQuestion);
    
    loadQuestionsList();
}

// Сохранение вопроса
function saveQuestion() {
    const x = parseInt(document.getElementById('adminX').value);
    const y = parseInt(document.getElementById('adminY').value);
    const question = document.getElementById('adminQuestion').value;
    const answer = document.getElementById('adminAnswer').value;
    const color = document.getElementById('adminColor').value;

    if (isNaN(x) || isNaN(y) || x < 0 || x > 9 || y < 0 || y > 9) {
        alert('Введите корректные координаты (0-9)');
        return;
    }

    if (!question || !answer) {
        alert('Заполните вопрос и ответ');
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
        alert('Вопрос сохранен!');
        clearAdminForm();
        loadQuestionsList();
    });
}

// Удаление вопроса
function deleteQuestion() {
    const x = parseInt(document.getElementById('adminX').value);
    const y = parseInt(document.getElementById('adminY').value);

    if (isNaN(x) || isNaN(y)) {
        alert('Введите координаты пикселя');
        return;
    }

    const pixelKey = `${x}-${y}`;
    database.ref('pixels/' + pixelKey).remove().then(() => {
        alert('Вопрос удален!');
        clearAdminForm();
        loadQuestionsList();
    });
}

// Загрузка списка вопросов
function loadQuestionsList() {
    database.ref('pixels').once('value').then(snapshot => {
        const questionsList = document.getElementById('questionsList');
        questionsList.innerHTML = '';
        
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
        updatePixelGrid(snapshot.val());
    });

    // Слушаем изменения пользователей
    database.ref('users').on('value', (snapshot) => {
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
                    pixelElement.style.backgroundColor = '#fff';
                    pixelElement.classList.remove('answered');
                    pixelElement.title = pixelData.question || 'Нет вопроса';
                }
            } else {
                pixelElement.style.backgroundColor = '#fff';
                pixelElement.classList.remove('answered');
                pixelElement.title = 'Нет вопроса';
            }
        }
    }
}

// Обновление списка игроков
function updatePlayersList(users) {
    if (!users) return;

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
    playersArray.forEach(user => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        playerElement.textContent = `${user.username} (${user.score})`;
        playersList.appendChild(playerElement);
    });

    // Обновляем таблицу лидеров
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

// Загрузка вопросов (для демонстрации)
function loadQuestions() {
    // В реальном приложении вопросы будут загружаться из базы данных
    // Здесь можно добавить начальные вопросы для демонстрации
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
