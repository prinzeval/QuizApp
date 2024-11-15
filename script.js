// Function to copy prompt text
function copyPrompt() {
    const promptText = document.getElementById("promptText");
    promptText.select();
    promptText.setSelectionRange(0, 99999); // For mobile devices
    document.execCommand("copy");
    alert("Prompt copied to clipboard!");
}

// Function to parse text input to JSON format for quiz questions
function parseTextToJSON(text) {
    const lines = text.split("\n");
    const questions = [];
    let currentQuestion = null;

    lines.forEach(line => {
        line = line.trim();
        const questionMatch = line.match(/^[A-E]\)\s*(.*)/) === null && line !== "" && line.indexOf("Answer:") === -1;
        if (questionMatch) {
            if (currentQuestion) questions.push(currentQuestion);
            currentQuestion = { question: line, options: [], answer: "" };
            return;
        }
        const optionMatch = line.match(/^[A-E]\)\s*(.*)/);
        if (optionMatch && currentQuestion) {
            currentQuestion.options.push(optionMatch[1].trim());
            return;
        }
        const answerMatch = line.match(/^Answer:\s*([A-E])/);
        if (answerMatch && currentQuestion) {
            const answerIndex = answerMatch[1].charCodeAt(0) - 65;
            currentQuestion.answer = currentQuestion.options[answerIndex];
            return;
        }
    });
    if (currentQuestion) questions.push(currentQuestion);
    return questions;
}

// Function to generate the quiz interface
function generateQuiz() {
    const textInput = document.getElementById("textInput").value;
    const questions = parseTextToJSON(textInput);
    if (questions.length === 0) {
        alert("No questions detected. Please check the format.");
        return;
    }
    const quizContainer = document.getElementById("quizContainer");
    quizContainer.style.display = "block";
    const quizForm = document.getElementById("quizForm");
    quizForm.innerHTML = "";

    questions.forEach((q, index) => {
        const questionDiv = document.createElement("div");
        questionDiv.classList.add("question");
        questionDiv.innerHTML = `<p>${index + 1}. ${q.question}</p>`;
        q.options.forEach(option => {
            const label = document.createElement("label");
            label.innerHTML = `<input type="radio" name="question${index}" value="${option}"> ${option}`;
            questionDiv.appendChild(label);
        });
        quizForm.appendChild(questionDiv);
    });

    window.questions = questions;
}

// Function to submit the quiz and display results
function submitQuiz() {
    const resultsDiv = document.getElementById("results");
    let score = 0;

    window.questions.forEach((q, index) => {
        const selectedOption = document.querySelector(`input[name="question${index}"]:checked`);
        const questionDiv = document.getElementsByClassName("question")[index];
        questionDiv.style.backgroundColor = ""; 
        questionDiv.style.border = "";
        const previousAnswer = questionDiv.querySelector(".correct-answer");
        if (previousAnswer) previousAnswer.remove();

        if (selectedOption) {
            if (selectedOption.value === q.answer) {
                score++;
                questionDiv.style.backgroundColor = "#e0f7e9";
                questionDiv.style.border = "2px solid #4CAF50";
            } else {
                questionDiv.style.backgroundColor = "#ffebee";
                questionDiv.style.border = "2px solid #f44336";
                addCorrectAnswer(questionDiv, q.answer);
            }
        } else {
            questionDiv.style.backgroundColor = "#ffebee";
            questionDiv.style.border = "2px solid #f44336";
            addCorrectAnswer(questionDiv, q.answer);
        }
    });
    resultsDiv.textContent = `Your score: ${score} / ${window.questions.length}`;
    document.querySelector(".btn-submit").disabled = true;
}

// Helper function to add correct answer for incorrect responses
function addCorrectAnswer(questionDiv, answer) {
    const correctAnswer = document.createElement("p");
    correctAnswer.textContent = `Correct Answer: ${answer}`;
    correctAnswer.style.color = "#4CAF50";
    correctAnswer.style.fontWeight = "bold";
    correctAnswer.classList.add("correct-answer");
    questionDiv.appendChild(correctAnswer);
}

// Function to reset the quiz
function resetQuiz() {
    const quizForm = document.getElementById("quizForm");
    quizForm.reset();  
    const resultsDiv = document.getElementById("results");
    resultsDiv.textContent = "";

    Array.from(document.getElementsByClassName("question")).forEach(questionDiv => {
        questionDiv.style.backgroundColor = "";  
        questionDiv.style.border = "";  
        const correctAnswer = questionDiv.querySelector(".correct-answer");
        if (correctAnswer) correctAnswer.remove();
    });

    document.querySelector(".btn-submit").disabled = false;
}
