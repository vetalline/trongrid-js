import Base from './Base';

let utils;

export default class Contract extends Base {

    constructor(tronGrid) {
        super(tronGrid);
        utils = this.utils;
    }

    /**
     * @name TG API: /v1//contracts/:contractAddress
     * @param contractAddress
     * @param options(onlyConfirmed, onlyUnconfirmed, eventName, blockNumber, fromTimestamp, size, previousFingerprint, sort)
     * @param callback
     * @returns list of events
     */
    getEvents(contractAddress, options = {}, callback = false) {

        if (utils.isFunction(options)) {
            callback = options;
            options = {};
        }

        if(!callback)
            return this.injectPromise(this.getEvents, contractAddress, options);

        this.validator.validateAddress(contractAddress);

        this.validator.validateOptions(options);

        contractAddress = this.tronWeb.address.fromHex(contractAddress);

        return this.APIClient.get(`v1/contracts/${contractAddress}/events`, options, callback);
    }

    async watchEvent(contractAddress, eventName, options = {}, callback = false) {
        let listener = false;
        let lastBlock = false;
        let since = Date.now() - 1000;

        const eventWatcher = async () => {
            try {
                options = Object.assign({
                    eventName,
                    minBlockTimestamp: since,
                    orderBy: 'timestamp,desc',
                    // TODO:
                    // add filters => eventron is already equipped for them
                    // filters: options.filters
                }, options)

                let events = await this.getEvents(contractAddress, options);

                const [latestEvent] = events.sort((a, b) => b.block_timestamp - a.block_timestamp);

                const newEvents = events.filter((event, index) => {
                    const duplicate = events.slice(0, index).some(priorEvent => (
                        JSON.stringify(priorEvent) == JSON.stringify(event)
                    ));

                    if (duplicate) return false;

                    if (!lastBlock) return true;

                    return event.block_timestamp > lastBlock;
                });

                if (latestEvent) lastBlock = latestEvent.block_timestamp;
                return newEvents;

            } catch (ex) {
                return Promise.reject(ex);
            }
        };

        const bindListener = () => {
            if (listener)
                clearInterval(listener);

            listener = setInterval(() => {
                eventWatcher().then(events => events.forEach(event => {
                    callback(null, event)
                })).catch(err => callback(err));
            }, 3000);
        };

        await eventWatcher();
        bindListener();

        return {
            start: bindListener(),
            stop: () => {
                if (!listener)
                    return;

                clearInterval(listener);
                listener = false;
            }
        }
    }

}
