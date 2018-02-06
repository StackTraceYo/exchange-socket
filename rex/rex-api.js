const bittrex = require('node-bittrex-api');
const config = require('../config/config');

bittrex.options({
    apikey: config.APP_CONFIG.REX.sandbox.apikey,
    apisecret: config.APP_CONFIG.REX.sandbox.apisecret,
});


function getCandles(market = 'USDT-BTC', interval = 'oneMin') {
    return new Promise(function (resolve, reject) {

        bittrex.getcandles({
            marketName: market,
            tickInterval: interval,
        }, function (data, err) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

module.exports = {
    getCandleData: getCandles,
};
