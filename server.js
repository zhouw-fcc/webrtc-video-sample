const express = require('express');
const uuidv4 = require('uuid').v4;
const http = require('http');
const WebsocketServer = require('websocket').server;

const app = express();
app.use(express.static('app'));

const httpServer = http.createServer(app);
httpServer.listen(1337, () => {
  console.log('Server listening at port 1337');
});

const wsServer = new WebsocketServer({ httpServer });
wsServer.on('request', onWSRequest);

let clients = [];
function onWSRequest(request) {
  const connection = request.accept();
  const id = uuidv4();
  clients.push({ id, connection });
  connection.on('message', message => onWSMessage(id, message));
  connection.on('close', () => onWSClose(id));
}

function onWSMessage(id, message) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  const recipients = clients.filter(c => c.id !== id);
  recipients.forEach(r => r.connection.send(message.utf8Data));
}

function onWSClose(id) {
  const clientIndex = clients.findIndex(c => c.id === id);
  if (clientIndex >= 0)
    clients.splice(clientIndex, 1);
}
