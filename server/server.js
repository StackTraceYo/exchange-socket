const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const APISocket = require('../api/api-socket');
const config = require('../config/config');
const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({server});
const port = config.APP_CONFIG.PORT.dev;

//On Each Connection
wss.on('connection', APISocket.apiSocketConnection);

server.listen(process.env.PORT || 5005, function listening() {
    console.log('Listening on %d', server.address().port);
});