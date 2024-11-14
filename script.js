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

        // Clear previous results
        questionDiv.style.backgroundColor = "";  // Reset background color
        questionDiv.style.border = "";  // Reset border color
        const previousAnswer = questionDiv.querySelector(".correct-answer");
        if (previousAnswer) {
            previousAnswer.remove();
        }

        if (selectedOption) {
            if (selectedOption.value === q.answer) {
                score++;
                questionDiv.style.backgroundColor = "#e0f7e9";  // Light green for correct
                questionDiv.style.border = "2px solid #4CAF50";  // Green border
            } else {
                questionDiv.style.backgroundColor = "#ffebee";  // Light red for incorrect
                questionDiv.style.border = "2px solid #f44336";  // Red border

                // Show the correct answer
                const correctAnswer = document.createElement("p");
                correctAnswer.textContent = `Correct Answer: ${q.answer}`;
                correctAnswer.style.color = "#4CAF50";  // Green text for correct answer
                correctAnswer.style.fontWeight = "bold";
                correctAnswer.classList.add("correct-answer");
                questionDiv.appendChild(correctAnswer);
            }
        } else {
            questionDiv.style.backgroundColor = "#ffebee";  // Light red for unanswered
            questionDiv.style.border = "2px solid #f44336";  // Red border
            const correctAnswer = document.createElement("p");
            correctAnswer.textContent = `Correct Answer: ${q.answer}`;
            correctAnswer.style.color = "#4CAF50";
            correctAnswer.style.fontWeight = "bold";
            correctAnswer.classList.add("correct-answer");
            questionDiv.appendChild(correctAnswer);
        }
    });

    resultsDiv.textContent = `Your score: ${score} / ${window.questions.length}`;
}
