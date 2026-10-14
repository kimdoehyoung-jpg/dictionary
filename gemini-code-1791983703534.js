// 데이터베이스 키 상수
const STORAGE_KEY = 'toeic_voca_db_v1';
const HISTORY_KEY = 'toeic_test_history_v1';

// 로컬 스토리지 데이터 로드 로직 (초경량화 됨)
let wordsData = JSON.parse(localStorage.getItem(STORAGE_KEY));
if (!wordsData) {
    wordsData = []; 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wordsData));
}

let testHistoryData = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let currentSort = 'latest';

// --- TTS (음성 합성, Text-to-Speech) 함수 ---
function speakWord(text, lang) {
    if (!('speechSynthesis' in window)) {
        alert("현재 사용 중인 브라우저가 음성 합성 기능을 지원하지 않습니다.");
        return;
    }
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang; // 'en-US', 'en-AU', 'en-GB'
    window.speechSynthesis.speak(utterance);
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wordsData));
    document.getElementById('total-words-count').innerText = wordsData.length;
}

function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(testHistoryData));
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if (screenId === 'manage-screen') renderWordList();
    if (screenId === 'history-screen') renderHistoryList();
    if (screenId === 'main-screen') document.getElementById('total-words-count').innerText = wordsData.length;
    
    toggleForm(false);
}

function setSort(type) {
    currentSort = type;
    
    document.getElementById('tab-latest').classList.toggle('active', type === 'latest');
    document.getElementById('tab-alphabet').classList.toggle('active', type === 'alphabet');
    document.getElementById('tab-recent-test').classList.toggle('active', type === 'recent-test');
    
    renderWordList();
}

function getAccuracyInfo(testCount, correctCount) {
    if (testCount === 0) return { text: "평가 전", color: "#6b7280" };
    const rate = (correctCount / testCount) * 100;
    const color = rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#ef4444";
    return { text: rate.toFixed(1) + "%", color: color };
}

const typeLabels = {
    noun: "명사", verb: "동사", adj: "형용사", adv: "부사", other: "기타"
};

function renderWordList() {
    const listContainer = document.getElementById('word-list');
    listContainer.innerHTML = '';

    let displayWords = [...wordsData];
    if (currentSort === 'latest') {
        displayWords.sort((a, b) => b.timestamp - a.timestamp);
    } else if (currentSort === 'alphabet') {
        displayWords.sort((a, b) => a.eng.localeCompare(b.eng));
    } else if (currentSort === 'recent-test') {
        displayWords.sort((a, b) => (b.lastTested || 0) - (a.lastTested || 0));
    }

    displayWords.forEach(word => {
        const accInfo = getAccuracyInfo(word.testCount, word.correctCount);
        const dateStr = new Date(word.timestamp).toLocaleDateString();
        
        let lastTestedStr = "평가 기록 없음";
        if (word.lastTested) lastTestedStr = new Date(word.lastTested).toLocaleString();

        const meaningsHtml = word.meanings.map(m => `
            <li class="meaning-item">
                <span class="badge ${m.type}">${typeLabels[m.type] || "기타"}</span>
                <span>${m.ko}</span>
            </li>
        `).join('');

        const card = document.createElement('div');
        card.className = 'word-card';
        card.innerHTML = `
            <div>
                <div class="word-header">
                    <div class="word-eng">
                        ${word.eng}
                        <div class="tts-group">
                            <button class="btn-tts" onclick="speakWord('${word.eng.replace(/'/g, "\\'")}', 'en-US')">미국식</button>
                            <button class="btn-tts" onclick="speakWord('${word.eng.replace(/'/g, "\\'")}', 'en-AU')">호주식</button>
                            <button class="btn-tts" onclick="speakWord('${word.eng.replace(/'/g, "\\'")}', 'en-GB')">영국식</button>
                        </div>
                    </div>
                    <div class="word-stats" style="color: ${accInfo.color}; font-weight: bold;">
                        정답률: ${accInfo.text} <br>
                        <span style="font-size: 0.75rem; color:#6b7280; font-weight: normal;">(출제: ${word.testCount}회)</span>
                    </div>
                </div>
                <ul class="meaning-list">${meaningsHtml}</ul>
                <div style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 4px;">등록일: ${dateStr}</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 12px;">최근 시험: ${lastTestedStr}</div>
            </div>
            <div class="word-actions">
                <button class="btn-secondary" onclick="editWord(${word.id})">수정</button>
                <button class="btn-light-danger" onclick="deleteWord(${word.id})">삭제</button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function renderHistoryList() {
    const listContainer = document.getElementById('history-list');
    listContainer.innerHTML = '';

    if (testHistoryData.length === 0) {
        listContainer.innerHTML = '<p style="color: #64748b;">아직 진행한 시험 기록이 없습니다.</p>';
        return;
    }

    testHistoryData.forEach(record => {
        const dateStr = new Date(record.date).toLocaleString();
        const accuracy = record.total > 0 ? ((record.correct / record.total) * 100).toFixed(1) : 0;
        
        let wordsListHtml = '';
        if (record.words && record.words.length > 0) {
            wordsListHtml = `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #cbd5e1;">`;
            record.words.forEach(w => {
                const statusText = w.isCorrect ? '<span style="color:#10b981; font-weight:bold; width: 24px; display:inline-block;">O</span>' : '<span style="color:#ef4444; font-weight:bold; width: 24px; display:inline-block;">X</span>';
                wordsListHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="font-size: 1rem; font-weight: 600; color: #334155;">
                            ${statusText} ${w.eng}
                        </div>
                        <div class="tts-group" style="margin-top: 0;">
                            <button class="btn-tts" onclick="speakWord('${w.eng.replace(/'/g, "\\'")}', 'en-US')">미국식</button>
                            <button class="btn-tts" onclick="speakWord('${w.eng.replace(/'/g, "\\'")}', 'en-AU')">호주식</button>
                            <button class="btn-tts" onclick="speakWord('${w.eng.replace(/'/g, "\\'")}', 'en-GB')">영국식</button>
                        </div>
                    </div>
                `;
            });
            wordsListHtml += `</div>`;
        }

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <div class="history-date">${dateStr}</div>
            <div class="history-score">총 ${record.total}문제 중 ${record.correct}개 아는 단어</div>
            <div class="history-details">
                <span style="color: #10b981; margin-right: 12px;">아는 단어: ${record.correct}개</span>
                <span style="color: #ef4444; margin-right: 12px;">모르는 단어: ${record.wrong}개</span>
                <span style="color: #3b82f6;">정답률: ${accuracy}%</span>
            </div>
            ${wordsListHtml}
        `;
        listContainer.appendChild(card);
    });
}

function toggleForm(forceOpen) {
    const form = document.getElementById('word-form');
    const btn = document.getElementById('btn-toggle-form');
    
    if (forceOpen === false || !form.classList.contains('hidden')) {
        form.classList.add('hidden');
        btn.innerText = '+ 새로운 단어 추가';
        clearForm();
    } else {
        form.classList.remove('hidden');
        btn.innerText = '취소';
        if (document.getElementById('meaning-rows-container').children.length === 0) {
            addMeaningRow(); 
        }
    }
}

function addMeaningRow(type = 'noun', ko = '') {
    const container = document.getElementById('meaning-rows-container');
    const row = document.createElement('div');
    row.className = 'meaning-row';
    row.innerHTML = `
        <select class="form-control type-select">
            <option value="noun" ${type === 'noun' ? 'selected' : ''}>명사</option>
            <option value="verb" ${type === 'verb' ? 'selected' : ''}>동사</option>
            <option value="adj" ${type === 'adj' ? 'selected' : ''}>형용사</option>
            <option value="adv" ${type === 'adv' ? 'selected' : ''}>부사</option>
            <option value="other" ${type === 'other' ? 'selected' : ''}>기타</option>
        </select>
        <input type="text" class="form-control ko-input" placeholder="한글 뜻" value="${ko}">
        <button class="btn-danger" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(row);
}

function clearForm() {
    document.getElementById('edit-word-id').value = '';
    document.getElementById('input-eng').value = '';
    document.getElementById('meaning-rows-container').innerHTML = '';
    document.getElementById('form-title').innerText = '단어 추가';
}

function saveWord() {
    const id = document.getElementById('edit-word-id').value;
    const eng = document.getElementById('input-eng').value.trim();
    
    const meaningRows = document.querySelectorAll('.meaning-row');
    const meanings = [];
    meaningRows.forEach(row => {
        const type = row.querySelector('.type-select').value;
        const ko = row.querySelector('.ko-input').value.trim();
        if (ko) meanings.push({ type, ko });
    });

    if (!eng || meanings.length === 0) {
        alert('영어 단어와 최소 1개의 한글 뜻을 입력해주세요.');
        return;
    }

    if (id) {
        const index = wordsData.findIndex(w => w.id == id);
        if (index !== -1) {
            wordsData[index].eng = eng;
            wordsData[index].meanings = meanings;
        }
    } else {
        wordsData.push({
            id: Date.now(),
            eng: eng,
            meanings: meanings,
            testCount: 0,
            correctCount: 0,
            timestamp: Date.now()
        });
    }

    saveData();
    toggleForm(false);
    renderWordList();
}

function editWord(id) {
    const word = wordsData.find(w => w.id === id);
    if (!word) return;

    document.getElementById('edit-word-id').value = word.id;
    document.getElementById('input-eng').value = word.eng;
    document.getElementById('form-title').innerText = '단어 수정';
    
    document.getElementById('meaning-rows-container').innerHTML = '';
    word.meanings.forEach(m => addMeaningRow(m.type, m.ko));

    toggleForm(true);
    document.getElementById('word-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteWord(id) {
    if (confirm('이 단어를 삭제하시겠습니까?')) {
        wordsData = wordsData.filter(w => w.id !== id);
        saveData();
        renderWordList();
    }
}

let testWords = [];
let currentTestIndex = 0;
let testResult = { correct: 0, wrong: 0 };

function startTest() {
    if (wordsData.length === 0) {
        alert('등록된 단어가 없습니다. 먼저 단어를 추가해주세요.');
        return;
    }

    testWords = [...wordsData].sort(() => Math.random() - 0.5).slice(0, 10).map(w => ({...w, isCorrectLog: false}));
    currentTestIndex = 0;
    testResult = { correct: 0, wrong: 0 };

    document.getElementById('test-area').classList.remove('hidden');
    document.getElementById('test-result-area').classList.add('hidden');
    
    showScreen('test-screen');
    loadTestWord();
}

function loadTestWord() {
    const word = testWords[currentTestIndex];
    document.getElementById('test-progress').innerText = `문제 ${currentTestIndex + 1} / ${testWords.length}`;
    document.getElementById('test-question').innerText = word.eng;
    
    document.getElementById('test-tts-us').onclick = () => speakWord(word.eng, 'en-US');
    document.getElementById('test-tts-au').onclick = () => speakWord(word.eng, 'en-AU');
    document.getElementById('test-tts-gb').onclick = () => speakWord(word.eng, 'en-GB');
    
    const meaningsHtml = word.meanings.map(m => `
        <li style="margin-bottom: 8px;">
            <span class="badge ${m.type}">${typeLabels[m.type] || "기타"}</span> ${m.ko}
        </li>
    `).join('');
    document.getElementById('test-answer-list').innerHTML = meaningsHtml;

    document.getElementById('test-answer').classList.add('hidden');
    document.getElementById('btn-show-meaning').classList.remove('hidden');
    document.getElementById('test-judge-btns').classList.add('hidden');
}

function showTestMeaning() {
    document.getElementById('test-answer').classList.remove('hidden');
    document.getElementById('btn-show-meaning').classList.add('hidden');
    document.getElementById('test-judge-btns').classList.remove('hidden');
}

function judgeAnswer(isCorrect) {
    testWords[currentTestIndex].isCorrectLog = isCorrect;
    const word = testWords[currentTestIndex];
    
    const targetWord = wordsData.find(w => w.id === word.id);
    if (targetWord) {
        targetWord.testCount += 1;
        targetWord.lastTested = Date.now();
        if (isCorrect) targetWord.correctCount += 1;
        saveData();
    }

    if (isCorrect) testResult.correct++;
    else testResult.wrong++;

    currentTestIndex++;

    if (currentTestIndex < testWords.length) {
        loadTestWord();
    } else {
        finishTest();
    }
}

function finishTest() {
    const testedWordsLog = testWords.map(w => ({
        eng: w.eng,
        isCorrect: w.isCorrectLog
    }));

    const testLog = {
        id: Date.now(),
        date: Date.now(),
        total: testWords.length,
        correct: testResult.correct,
        wrong: testResult.wrong,
        words: testedWordsLog
    };
    
    testHistoryData.unshift(testLog);
    saveHistory();

    document.getElementById('test-area').classList.add('hidden');
    document.getElementById('test-result-area').classList.remove('hidden');
    
    document.getElementById('test-result-stats').innerHTML = `
        <span style="color: #10b981;">아는 단어: ${testResult.correct}개</span> <br>
        <span style="color: #ef4444;">모르는 단어: ${testResult.wrong}개</span>
    `;
}

// 화면 로드 시 초기 진입 카운트 업데이트
document.getElementById('total-words-count').innerText = wordsData.length;