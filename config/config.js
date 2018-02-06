//todo switch to better config/environment/constants/ect..

const config =
    {
        PORT: {
            dev: 5005
        },
        REX: {
            sandbox: {
                apikey: 'api-key here',
                apisecret: 'api-secret here'
            }
        },
        GDAX: {
            public: {
                apikey: '',
                secret: '',
                rest: 'https://api.gdax.com',
                ws: 'wss://ws-feed.gdax.com'
            }
        }
    };

module.exports = {
    APP_CONFIG: config,
};