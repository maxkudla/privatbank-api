const crypto = require('crypto');
const assert = require('assert');

const parser = require('xml2json');
const moment = require('moment');

const request = require('./request');

const DATE_FORMAT = 'DD.MM.YYYY';

const DATE_RANGE = {
    today: () => moment().format(DATE_FORMAT),
    monthAgo: () => moment().subtract(1, 'month').format(DATE_FORMAT)
};

function required(field) {
    const message = Array.isArray(field)
        ? `${field.join(', ')} ${field.length > 1 ? 'are' : 'is'} required`
        : `${field} is required`;

    return assert(false, message);
}

module.exports = class {

    constructor(opts = required(['id', 'password'])) {
        const {
            id = required('merchantId'),
            password = required('password'),
            country = 'UA',
            phone = null,
            card = null,
            test = 0,
        } = opts;

        Object.assign(this, opts);
    }

    _signature(data) {
        const hash = crypto.createHash('md5');
        hash.update(`${data}${this.password}`);

        const signature = crypto.createHash('sha1');
        signature.update(hash.digest('hex'));

        return signature.digest('hex');
    }

    _request(url, data) {
        const requestData = `<?xml version="1.0" encoding="UTF-8"?>
            <request version="1.0">
                <merchant>
                    <id>${this.id}</id>
                    <signature>${this._signature(data)}</signature>
                </merchant>
                <data>
                    ${data}
                </data>
            </request>`;

        return request.post(`https://api.privatbank.ua/p24api${url}`, requestData)
            .then((response) => parser.toJson(response.data));
    }

    balance(card = this.card) {
        card = card || required('Card number');

        const data = `<oper>cmt</oper>
            <wait>90</wait>
            <test>0</test>
            <payment id="">
                <prop name="cardnum" value="${card}" />
                <prop name="country" value="${this.country}" />
            </payment>`;

        return this._request('/balance', data);
    }

    statement(card = this.card, startDate = DATE_RANGE.monthAgo(), endDate = DATE_RANGE.today()) {
        card = card || required('Card number');

        const data = `<oper>cmt</oper>
            <wait>90</wait>
            <test>0</test>
            <payment id="">
                <prop name="sd" value="${startDate}"/>
                <prop name="ed" value="${endDate}"/>
                <prop name="cardnum" value="${card}"/>
                <prop name="country" value="${this.country}" />
            </payment>`;

        return this._request('/rest_fiz', data);
    }

    sms(user_phone, text) {
        let my_phone = this.phone || required('Merchant phone number');
        user_phone = user_phone || required('Phone number');

        const data = `<oper>cmt</oper>
            <wait>90</wait>
            <test>${this.test}</test>
            <payment id="">
                <prop name="phone" value="%2B380${my_phone}" />
                <prop name="phoneto" value="%2B380{user_phone}" />
                <prop name="text" value="${text}" />
            </payment>`;

    }
};
