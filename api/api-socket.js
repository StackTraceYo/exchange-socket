const GDAXApi = require('../gdax/gdax-api');
const RexApi = require('../rex/rex-api');
const WebSocket = require('ws');

function apiSocketConnection(ws, req) {

    console.log("Got Connection");
    try {
        ws.on('open', function (message) {
            console.log("Connection Opened With Client");
        });
        ws.on('message', function incoming(message) {
            if (ws.readyState === WebSocket.OPEN) {
                console.log('received: %s', message);
                const parsed = JSON.parse(message);
                switch (parsed.type) {
                    case "refreshOrderbook":
                        try {
                            ws.send(JSON.stringify({type: 'orderbookRefresh', data: GDAXApi.sync(parsed.book)}))
                        } catch (err) {
                            console.log(err);
                            ws.send(JSON.stringify({type: 'ERROR_RECONNECT'}));
                            ws.close();
                        }
                        break;
                    case "marketData":
                        try {
                            if (ws.readyState === WebSocket.OPEN) {
                                RexApi.getCandleData(parsed.book)
                                    .then(function (result) {
                                        ws.send(JSON.stringify({type: 'marketDataRefresh', data: result}));
                                    }, function (err) {
                                        ws.send(JSON.stringify({type: 'marketDataRefresh', data: []}));
                                    });
                            }
                        } catch (err) {
                            //todo
                        }
                        break;
                    case "feed":
                        if (ws.readyState === WebSocket.OPEN) {
                            GDAXApi.attachFeed(ws, parsed.subscriber, parsed.book)
                        }
                        break;
                    default:
                        break;
                }
            }
        });
        ws.on('close', function (message) {
            console.log("Connection Closed");
        });
        ws.on('error', function (error) {
            console.log(error);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({type: 'ERROR_RECONNECT'}));
                ws.close();
            }
        })
    } catch (err) {
        console.log(err);
        ws.send(JSON.stringify({type: 'ERROR_RECONNECT'}));
        ws.close();
    }
}

module.exports = {
    apiSocketConnection: apiSocketConnection,
};