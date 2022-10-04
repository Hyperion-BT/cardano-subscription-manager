/** @typedef {import("./render.js").UI} UI */
import { html } from "./render.js";
import { useState } from "./hooks.js";
/** @typedef {import("./helios.js").MintingPolicyHash} MintingPolicyHash */
import { Address, Assets, Value, bytesToHex, hexToBytes } from "./helios.js";

export const ADA = "₳";

/**
 * @param {{id: string, value: string, onInput: (s: string) => void, error: string, disabled?: boolean, type?: string}} props
 * @returns {any}
 */
function renderInput(props) {
    return html`
        <div class="input-wrapper">
            <input 
                id=${props.id} 
                value=${props.value}
                invalid=${props.error != "" ? "" : null} 
                onInput=${(/** @type {Event} */ e) => props.onInput(e.target?.value)} 
                disabled=${props.disabled}
                type=${props.type === undefined ? "text" : props.type}
            />
            ${props.error != "" ?
            html`<p class="input-error">${props.error}</p>` :
            null
        }
        </div>
    `;
}

/**
 * @param {string} id 
 * @param {string} value 
 * @param {string[]} options 
 * @param {() => void} onChange 
 * @returns {UI}
 */
function renderSelect(id, value, options, onChange) {
    return html`
        <select id=${id} value=${value} onChange=${onChange} disabled=${options.length == 1 && options[0] == value}>
            ${
                options.map(optionValue => html`<option key=${optionValue} value=${optionValue}>${optionValue}</option>`)
            }
        </select>
    `;
}

// TODO: dropdown for interval amount (currently is just 'days')
export class IntervalInput {
    #id;
    #rawValue;
    #setRawValue;

    /**
     * @param {string} id
     */
    constructor(id) {
        this.#id = id;

        [this.#rawValue, this.#setRawValue] = useState("30");
    }

    /**
     * @param {string} value 
     * @returns {string} - error (if empty -> no error)
     */
    static validate(value) {
        if (value == "") {
            return "";
        }

        const x = parseFloat(value);

        if (Number.isNaN(x) || (value.match(/^[0-9]+(\.[0-9]+)?$/) === null)) {
            return "invalid number";
        } else if (x == 0.0) {
            return "can't be zero";
        } else if (x < 0.0) {
            return "can't be negative";
        } else {
            return "";
        }
    }

    isValid() {
        return IntervalInput.validate(this.#rawValue) == "" && this.#rawValue != "";
    }

    /**
     * @returns {bigint}
     */
    getInterval() {
        return BigInt(parseFloat(this.#rawValue) * 1000*3600*24);
    }

    /**
     * @returns {any}
     */
    render() {
        const error = IntervalInput.validate(this.#rawValue);

        return html`
            <div class="interval-input">
                ${renderInput({id: this.#id, value: this.#rawValue, onInput: this.#setRawValue, error: error, disabled: false})}
                <p>Days</p>
            </div>
        `;
    }
}

export class DateTimeInput {
    #id;
    #rawDateValue;
    #setRawDateValue;
    #rawTimeValue;
    #setRawTimeValue;

    /**
     * 
     * @param {string} id 
     */
    constructor(id) {
        this.#id = id;

        let now = new Date((new Date()).getTime() + 1000*60*10); // 10 minutes in future;

        let year = now.getFullYear().toString();

        let month = (now.getMonth() + 1).toString();
        if (month.length == 1) {
            month = "0" + month;
        }
        let day = now.getDate().toString();
        if (day.length == 1) {
            day = "0" + day;
        }

        let hours = now.getHours().toString();
        if (hours.length == 1) {
            hours = "0" + hours;
        }

        let minutes = now.getMinutes().toString();
        if (minutes.length == 1) {
            minutes = "0" + minutes;
        }

        [this.#rawDateValue, this.#setRawDateValue] = useState(`${year}-${month}-${day}`);
        [this.#rawTimeValue, this.#setRawTimeValue] = useState(`${hours}:${minutes}`);
    }

    get aggregateValue() {
        return [this.#rawDateValue, this.#rawTimeValue].join(" ");
    }

    /**
     * @param {string} value 
     * @returns {string} - error (if empty -> no error)
     */
    static validate(value) {
        if (value == "") {
            return "";
        }

        if (new Date(value).getTime() < (new Date()).getTime()) {
            return "in past";
        } else {
            return "";
        }
    }

    isValid() {
        return DateTimeInput.validate(this.aggregateValue) == "" && this.aggregateValue != "";
    }

    /**
     * @returns {Date}
     */
    getDate() {
        return new Date(this.aggregateValue);
    }

    /**
     * @returns {any}
     */
    render() {
        const error = DateTimeInput.validate(this.aggregateValue);

        return html`
            <div class="date-time-input">
                ${renderInput({id: this.#id, value: this.#rawDateValue, onInput: this.#setRawDateValue, error: error, disabled: false, type: "date"})}
                ${renderInput({id: this.#id + "-time", value: this.#rawTimeValue, onInput: this.#setRawTimeValue, error: "", disabled: false, type: "time"})}
            </div>
        `;
    }
}

export class AdaInput {
    #id;
    #balance;
    #rawValue;
    #setRawValue;

    /**
     * @param {string} id 
     * @param {?Value} balance 
     */
    constructor(id, balance = null) {
        this.#id = id;
        this.#balance = balance;

        [this.#rawValue, this.#setRawValue] = useState("");
    }

    /**
     * @param {string} value 
     * @param {?Value} balance 
     * @returns {string} - error (if empty -> no error)
     */
    static validate(value, balance = null) {
        if (value == "") {
            return "";
        }

        const ada = parseFloat(value);

        if (Number.isNaN(ada) || (value.match(/^[0-9]+(\.[0-9]+)?$/) === null)) {
            return "invalid number";
        } else {
            const lovelace = ada * 1000000;

            if (lovelace % 1 != 0) {
                return "too many decimal places (max 6)";
            } else if (lovelace < 0) {
                return "invalid negative number";
            } else if (lovelace == 0) {
                return "can't be zero";
            } else if (balance !== null) {
                if (Number(balance.lovelace) < lovelace) {
                    return "insufficient funds";
                } else {
                    return "";
                }
            } else {
                return "";
            }
        }
    }

    isValid() {
        return AdaInput.validate(this.#rawValue, this.#balance) == "" && this.#rawValue != "";
    }

    /**
     * @returns {Value}
     */
    getValue() {
        const x = BigInt(parseFloat(this.#rawValue) * 1000000);

        return new Value(x);
    }

    /**
     * @returns {any}
     */
    render() {
        const error = AdaInput.validate(this.#rawValue);

        return html`
            <div class="price-input">
                ${renderInput({id: this.#id, value: this.#rawValue, onInput: this.#setRawValue, error: error, disabled: false})}
                <p>${ADA}</p>
            </div>
        `;
    }
}

/**
 * @param {string} id 
 * @param {Value} balance 
 */
 export class AssetInput {
    #id;
    #balance;
    #rawValue;
    #setRawValue;
    #mph;
    #setMph;
    #tokenNames;
    #tokenName;
    #setTokenName;

    /**
     * @param {string} id 
     * @param {Value} balance 
     */
    constructor(id, balance) {
        this.#id = id;
        this.#balance = balance;

        [this.#rawValue, this.#setRawValue] = useState("");
        [this.#mph, this.#setMph] = useState(balance.assets.mintingPolicies[0]);
        this.#tokenNames = balance.assets.getTokenNames(this.#mph);
        [this.#tokenName, this.#setTokenName] = useState(this.#tokenNames[0]);
    }

    /**
     * Returns empty string if valid
     * @param {string} value
     * @param {Value} balance
     * @param {MintingPolicyHash} mph
     * @param {number[]} tokenName
     * @returns {string}
     */
    static validate(value, balance, mph, tokenName) {
        if (value == "") {
            return "";
        }

        const iValue = parseInt(value);

        if (Number.isNaN(iValue) || iValue.toString() != value) {
            return "invalid number";
        } else if (iValue < 0) {
            return "invalid negative number";
        } else if (iValue == 0) {
            return "can't be zero";
        } else {
            const available = balance.assets.get(mph, tokenName);

            if (iValue > available) {
                return "insufficient assets";
            } else {
                return "";
            }
        }
    }

    /**
     * @returns {boolean}
     */
    isValid() {
        return AssetInput.validate(this.#rawValue, this.#balance, this.#mph, this.#tokenName) == "" && this.#rawValue != "";
    }

    /**
     * @returns {Value}
     */
    getValue() {
        return new Value(0n, new Assets([[this.#mph, [[this.#tokenName, BigInt(parseInt(this.#rawValue))]]]]));
    }

    /**
     * @returns {any}
     */
    render() {
        const error = AssetInput.validate(this.#rawValue, this.#balance, this.#mph, this.#tokenName);

        const mphId = this.#id + "-mph";
        const tnId  = this.#id + "-tn";
        const qtyId = this.#id + "-qty";

        return html`
            <div id=${this.#id} class="asset-input">
                <label for=${mphId}>Policy ID</label>
                ${renderSelect(mphId, this.#mph.toBech32(), this.#balance.assets.mintingPolicies.map(mph => mph.toBech32()), (/** @type {Event} */ e) => this.#setMph(
                    this.#balance.assets.mintingPolicies.find(mph => mph.toBech32() == e.target?.value)
                ))}
                <label for=${tnId}>Token Name</label>
                ${renderSelect(tnId, bytesToHex(this.#tokenName), this.#tokenNames.map(t => bytesToHex(t)), (/** @type {Event} */ e) => this.#setTokenName(hexToBytes(e.target?.value)))}
                <label for=${qtyId}>Quantity</label>
                ${renderInput({id: qtyId, value: this.#rawValue, onInput: this.#setRawValue, error: error, disabled: false})}
            </div>
        `;
    }
}

// network is used to check that correct address type is used (testnet or mainnet)
export class AddressInput {
    #id;
    #rawValue;
    #setRawValue;

    /**
     * @param {string} id 
     */
    constructor(id) {
        this.#id = id;
        [this.#rawValue, this.#setRawValue] = useState("");
    }

    /**
     * @param {string} value
     * @returns {string}
     */
    static validate(value) {
        if (value == "") {
            return "";
        }

        try {
            const address = Address.fromBech32(value);

            if (address.pubKeyHash === null) {
                return "not a regular payment address (script address)";
            }

            if (!address.isForTestnet()) {
                return "not a testnet address";
            }

            return "";
        } catch (_e) {
            return "invalid address";
        }
    }

    isValid() {
        return AddressInput.validate(this.#rawValue) == "" && this.#rawValue != "";
    }

    /**
     * @returns {?Address}
     */
    getAddress() {
		return Address.fromBech32(this.#rawValue);
    }

    /**
     * @returns {any}
     */
    render() {
        const error = AddressInput.validate(this.#rawValue);

        return html`
            <div class="address-input">
                ${renderInput({id: this.#id, value: this.#rawValue, onInput: this.#setRawValue, error: error})}
            </div>
        `;
    }
}