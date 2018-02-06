const Gdax = require('gdax');
const WebSocket = require('ws');
const _ = require('lodash');
const config = require('../config/config');

//todo figure out a way to better handle the orderbook failing
let ltcSync = new Gdax.OrderbookSync(['LTC-USD'], config.APP_CONFIG.GDAX.public.rest, config.APP_CONFIG.GDAX.public.ws);
let btcSync = new Gdax.OrderbookSync(['BTC-USD'], config.APP_CONFIG.GDAX.public.rest, config.APP_CONFIG.GDAX.public.ws);
let ethSync = new Gdax.OrderbookSync(['ETH-USD'], config.APP_CONFIG.GDAX.public.rest, config.APP_CONFIG.GDAX.public.ws);

const feeds = {
    'BTC-USD': {
        subs: {},
        feed: null,
        size: 0
    },
    'ETH-USD': {
        subs: {},
        feed: null,
        size: 0
    },
    'LTC-USD': {
        subs: {},
        feed: null,
        size: 0
    }
};

//todo fix this hack
function heal() {

    if (btcSync.books['BTC-USD'].state().bids.length === 0) {
        console.log("Healing BTC-USD");
        btcSync = new Gdax.OrderbookSync(['BTC-USD'], config.APP_CONFIG.GDAX.public.rest, config.APP_CONFIG.GDAX.public.ws);
    }
    if (ethSync.books['ETH-USD'].state().bids.length === 0) {
        console.log("Healing ETH-USD");
        ethSync = new Gdax.OrderbookSync(['ETH-USD'], config.APP_CONFIG.GDAX.public.rest, config.APP_CONFIG.GDAX.public.ws);
    }
    if (ltcSync.books['LTC-USD'].state().bids.length === 0) {
        console.log("Healing LTC-USD");
        ltcSync = new Gdax.OrderbookSync(['LTC-USD'], config.APP_CONFIG.GDAX.public.rest, config.APP_CONFIG.GDAX.public.ws);
    }
}

function getSyncState(book = 'BTC-USD') {
    switch (book) {
        case 'BTC-USD':
            return btcSync.books[book].state();
        case 'ETH-USD':
            return ethSync.books[book].state();
        case 'LTC-USD':
            return ltcSync.books[book].state();
    }
}

//handles feed(s) <-> user interaction
function setupFeed(feed, feedName) {
    let matchQueue = [];
    let hbBatch = 20;
    let tickBatch = 2;
    // lets always send data on client connect
    let init_match = false;
    let init_tick = false;
    let init_hb = false;

    //on message from exchange
    feed.on('message', data => {
        //forward to subscribers
        if (feeds[feedName].size > 0) { //if there are subscribers
            let msg;
            switch (data.type) {
                case 'match':
                    matchQueue.push(data);
                    //batch matches or if it is the initial one send right away
                    if (matchQueue.length >= 8 || !init_match) {
                        console.log("Sending Match Batch");
                        msg = {type: "match", data: matchQueue};
                        matchQueue = [];
                        init_match = true;
                    }
                    break;
                case 'heartbeat':
                    //batch matches or if it is the initial one send right away
                    if (hbBatch <= 0 || !init_hb) {
                        msg = data;
                        hbBatch = 20;
                        init_hb = true;
                    } else {
                        hbBatch--;
                    }
                    break;
                case 'ticker':
                    //batch matches or if it is the initial one send right away
                    if (tickBatch <= 0 || !init_tick) {
                        msg = data;
                        tickBatch = 2;
                        init_tick = true;
                    } else {
                        tickBatch--;
                    }
                    break;
                default:
                    break;
            }
            if (msg) {
                msg['exchange'] = "gdax";
                let active = {};
                let aCount = 0;
                //for each subscriber
                _.forEach(feeds[feedName].subs, (subscriber, subname) => {
                    if (subscriber.readyState === WebSocket.OPEN) { //if his socket open
                        subscriber.send(JSON.stringify(msg)); //send frame
                        active[subname] = subscriber; //keep connection as active
                        aCount++;
                    } else {
                        console.log("Removing Subscription..")
                        //remove connection
                    }
                });
                console.log("Forwarded " + data.type + " to " + aCount + " subscribers");
                //set active subscriptions again
                feeds[feedName].subs = active;
                feeds[feedName].size = aCount;
            }
        }
    });
}

function feedSubscription(ws, subscribername, feedName = 'BTC-USD') {
    if (ws.readyState === WebSocket.OPEN) {
        _.forEach(feeds, (feed_data, feed_name) => { //for each feed
            console.log(`Subscribers For : ${feed_name}`);
            _.forEach(feed_data.subs, (subscriber, subname) => { //for each subscriber
                console.log(`Subscribers For : ${subname}`);
                if (subname === subscribername) { //if is a subscriber to something else
                    console.log("Unsubbing for Other Feed");
                    feed_data.size = feed_data.size - 1;
                    delete feed_data.subs[subscribername]; //remove subscription
                    return false; //this will break out of lodash loop
                }
            });
        });
        let currentFeed = feeds[feedName];
        //check if there is a feed already
        if (currentFeed.feed != null) {
            currentFeed.subs[subscribername] = ws; //add subscriber to this feed
            currentFeed.size = currentFeed.size + 1; // set subscriber count
        } else {
            //init feed for product since it was not available
            let feed = new Gdax.WebsocketClient([feedName], config.APP_CONFIG.GDAX.public.ws, null, {channels: ['heartbeat', 'ticker', 'matches']});
            //bind feed
            setupFeed(feed, feedName);
            //store feed information
            currentFeed.feed = feed;
            currentFeed.subs[subscribername] = ws;
            currentFeed.size = currentFeed.size + 1;
        }
    }
}

/*
    This method closes feeds to gdax if there are no subscribers
 */
function closeUnusedFeeds() {
    console.log('Closing Unused Feeds!');
    _.forEach(feeds, (feed_data, feed_name) => {
        console.log(`Subscribers For : ${feed_name} is ${feed_data.size}`);

        if (feed_data.feed != null) {
            console.log(`Feed ${feed_name} is Open`)
        }
        if (feed_data.feed != null && feed_data.size <= 0) {
            console.log(`No Subscribers For : ${feed_name} Closing...`);
            feed_data.feed = null
        }
    })
}

/*
    This method cleans subscribers that maybe orphaned for whatever reason
 */
function closeOrphanSubscribers() {
    console.log('Closing Orphaned Feeds!');
    _.forEach(feeds, (feed_data, feed_name) => {
        console.log(`Subscribers For : ${feed_name} is ${feed_data.size}`);
        _.forEach(feed_data.subs, (sub, sub_name) => {
            let readyState = sub.readyState;
            if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
                console.log(`Feed For ${sub_name} is Open`)
            } else {
                console.log(`Feed For ${sub_name} is Closed Closing Socket`);
                delete feed_data.subs[sub_name];
            }
        })
    })
}

//close and clean subscribers at intervals
setInterval(closeUnusedFeeds, 20000);
setInterval(heal, 20000);
setInterval(closeOrphanSubscribers, 30000);


module.exports = {
    sync: getSyncState,
    orderbook: ltcSync,
    attachFeed: feedSubscription
};
