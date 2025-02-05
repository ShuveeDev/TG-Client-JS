const fs = require('fs');
const prompt = require('prompt-sync')();  
function listSessions(sessions) {
  console.log("Доступні сесії:");
  Object.keys(sessions).forEach((key, index) => {
    console.log(`${index + 1}. ${key}`);
  });
}

function deleteSession(sessions, sessionId) {
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    console.log(`Сесію ${sessionId} було видалено.`);
  } else {
    console.log(`Сесія ${sessionId} не знайдена.`);
  }
}

function saveSessionsToFile(sessions) {
  fs.writeFileSync('sessions.json', JSON.stringify(sessions, null, 2), 'utf-8');
  console.log("Сесії оновлено та збережено в файл sessions.json");
}


function main() {
  const sessionsData = fs.readFileSync('sessions.json', 'utf-8');
  const sessions = JSON.parse(sessionsData);

  listSessions(sessions);

  const choice = prompt("\nВиберіть номер сесії для видалення: ");
  
  const sessionId = Object.keys(sessions)[parseInt(choice) - 1];
  if (sessionId) {
    deleteSession(sessions, sessionId);
    saveSessionsToFile(sessions);
  } else {
    console.log("Невірний номер сесії.");
  }
}

main();
