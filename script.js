function parseTextToJSON(text) {
    const lines = text.split("\n");
    const questions = [];
    let currentQuestion = null;

    lines.forEach(line => {
        line = line.trim();

        // Check if line is a new question (does not start with an option or "Answer:")
        const questionMatch = line.match(/^[A-E]\)\s*(.*)/) === null && line !== "" && line.indexOf("Answer:") === -1;
        if (questionMatch) {
            // If there's an existing question, push it to questions array before starting a new one
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                question: line,
                options: [],
                answer: ""
            };
            return;
        }

        // Check if line is an option
        const optionMatch = line.match(/^[A-E]\)\s*(.*)/);
        if (optionMatch && currentQuestion) {
            currentQuestion.options.push(optionMatch[1].trim());
            return;
        }

        // Check if line specifies the answer
        const answerMatch = line.match(/^Answer:\s*([A-E])/);
        if (answerMatch && currentQuestion) {
            const answerIndex = answerMatch[1].charCodeAt(0) - 65;
            currentQuestion.answer = currentQuestion.options[answerIndex];
            return;
        }
    });

    // Add the last question if it exists
    if (currentQuestion) {
        questions.push(currentQuestion);
    }

    return questions;
}

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
            label.innerHTML = `
                <input type="radio" name="question${index}" value="${option}">
                ${option}
            `;
            questionDiv.appendChild(label);
        });

        quizForm.appendChild(questionDiv);
    });

    window.questions = questions;
}

function submitQuiz() {
    const resultsDiv = document.getElementById("results");
    let score = 0;

    window.questions.forEach((q, index) => {
        const selectedOption = document.querySelector(`input[name="question${index}"]:checked`);
        const questionDiv = document.getElementsByClassName("question")[index];

        if (selectedOption) {
            if (selectedOption.value === q.answer) {
                score++;
                questionDiv.classList.add("correct");
            } else {
                questionDiv.classList.add("incorrect");
            }
        } else {
            questionDiv.classList.add("incorrect");
        }
    });

    resultsDiv.textContent = `Your score: ${score} / ${window.questions.length}`;
}
function copyPrompt() {
    const promptText = document.getElementById("promptText");
    promptText.select();
    document.execCommand("copy");
    alert("Prompt copied to clipboard!");
}
