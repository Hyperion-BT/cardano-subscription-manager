import { html, SPACE } from "./render.js";

/** @typedef {import("./helios.js").UplcData} UplcData */
/** @typedef {import("./helios.js").UplcProgram} UplcProgram */
import { Address, ConstrData, InlineDatum, Program, PubKeyHash, Value, hexToBytes, bytesToHex, highlight, UTxO } from "./helios.js";

const optimize = true;

export const contractScript = `
spending  basic_subscription

// TODO: check staking part as well (as soon as blockfrost fully supports mangled addresses)
struct Datum {
    customer:        PubKeyHash
    vendor:          PubKeyHash
    funds:           Value
    price:           Value              
    interval:        Duration
    next_withdrawal: Time

    func customer_signed(self, tx: Tx) -> Bool {
        tx.is_signed_by(self.customer)
    }

    func vendor_signed(self, tx: Tx) -> Bool {
        tx.is_signed_by(self.vendor)
    }

    func interval_passed(self, tx: Tx) -> Bool {
        tx.now() >= self.next_withdrawal
    }

    func next_datum(self, remaining_funds: Value) -> Datum {
        Datum{
            customer:        self.customer,
            vendor:          self.vendor,
            funds:           remaining_funds,
            price:           self.price,
            interval:        self.interval,
            next_withdrawal: self.next_withdrawal + self.interval
        }
    }

    func remaining_funds_locked_correctly(self, tx: Tx, contract_hash: ValidatorHash) -> Bool {
        remaining: Value = self.funds - self.price;

        tx.value_locked_by_datum(contract_hash, self.next_datum(remaining), true) >= remaining
    }
}

func main(datum: Datum, ctx: ScriptContext) -> Bool {
    tx: Tx = ctx.tx;

    // probably no need for double satisfaction protection due to high likelihood that datum is always unique

    datum.customer_signed(tx) || (
        contract_hash: ValidatorHash = ctx.get_current_validator_hash();

        datum.vendor_signed(tx) && 
        datum.interval_passed(tx) &&
        datum.remaining_funds_locked_correctly(tx, contract_hash)
    )
}`;

const datumScript = `
// code to generate a Datum for a new subscription
const CUSTOMER_BYTES = # // must be 28 bytes long
const VENDOR_BYTES   = # // must be 28 bytes long
const FUNDS_LOVELACE = 0
const PRICE_LOVELACE = 0
const INTERVAL_MS    = 0
const NEXT_WDRWL_MS  = 0

const DATUM = Datum{
    customer: PubKeyHash::new(CUSTOMER_BYTES),
    vendor:   PubKeyHash::new(VENDOR_BYTES),
    funds:    Value::lovelace(FUNDS_LOVELACE),
    price:    Value::lovelace(PRICE_LOVELACE),
    interval: Duration::new(INTERVAL_MS),
    next_withdrawal: Time::new(NEXT_WDRWL_MS)
}`;

const src = contractScript + datumScript;

/**
 * @returns {UplcProgram}
 */
export function getCompiledProgram() {
    return Program.new(contractScript).compile(optimize);
}

/**
 * @returns {Address}
 */
export function calcScriptAddress() {
    return Address.fromValidatorHash(true, Program.new(contractScript).compile(optimize).validatorHash);
}


export const highlightedContract = (function() {
    const elems = [];

    const src = contractScript.trim();
    const markers = highlight(src);
    const n = markers.length;

    /** @type {any[]} */
    let currentLine = [];

    /** @type {string[]} */
    let currentChars = [];

    let currentMarker = -1;

    function flushChars() {
        if (currentChars.length > 0) {
            currentLine.push(html`<span c="${currentMarker}">${currentChars.join("")}</span>`);
            currentChars = [];
        }
    }

    function flushLine() {
        elems.push(html`<pre>${currentLine}</pre>`);
        currentLine = [];
    }

    for (let i = 0; i < n; i++) {
        const m = markers[i];

        if (m != currentMarker) {
            flushChars();
        }

        currentMarker = m;
        const c = src.at(i);

        if (c === undefined) {
            throw new Error("unexpected");
        } else if (c == '\n') {
            flushChars();

            if (currentLine.length == 0) {
                elems.push(html`<br/>`);
            } else {
                flushLine();
            }
        } else if (c == ' ') {
            currentChars.push(SPACE);
        } else {
            currentChars.push(c);
        }
    }

    flushChars();

    if (currentLine.length > 0) {
        flushLine();
    }

    return elems;
})();

// utxos are grouped per contract
export class Contract {
    #datum;
    #utxos;

    /**
     * 0: starting, 1: active, 2: ending
     * @type {number}
     */
    #state;

    /**
     * @param {ConstrData} datum 
     * @param {UTxO[]} utxos
     * @param {number} state 
     */
    constructor(datum, utxos, state = 1) {
        this.#datum = datum;
        this.#utxos = utxos;
        this.#state = state;
    }

    /**
     * @type {ConstrData}
     */
    get datum() {
        return this.#datum;
    }
    
    /**
     * @type {UTxO[]}
     */
    get utxos() {
        return this.#utxos.slice();
    }

    /**
     * @type {PubKeyHash}
     */
    get customer() {
        return new PubKeyHash(this.#datum.fields[0].bytes);
    }

    /**
     * Doesn't include the staking part
     * @type {Address}
     */
    get customerAddress() {
        return Address.fromPubKeyHash(true, this.customer);
    }

    /**
     * @type {PubKeyHash}
     */
    get vendor() {
        return new PubKeyHash(this.#datum.fields[1].bytes);
    }

    /**
     * @type {Address}
     */
    get vendorAddress() {
        return Address.fromPubKeyHash(true, this.vendor);
    }

    /**
     * @type {Value}
     */
    get funds() {
        return Value.fromData(this.#datum.fields[2]);
    }

    /**
     * @type {Value}
     */
    get price() {
        return Value.fromData(this.#datum.fields[3]);
    }

    /**
     * @type {bigint}
     */
    get interval() {
        return this.#datum.fields[4].int;
    }

    /**
     * @type {Date}
     */
    get nextWithdrawal() {
        return new Date(Number(this.#datum.fields[5].int));
    }

    /**
     * @returns {boolean}
     */
    canWithdraw() {
        let date = this.nextWithdrawal;

        // now must be after nextWithdrawal
        return (new Date()).getTime() >= date.getTime();
    }

    /**
     * @type {Value}
     */
    get available() {
        return UTxO.sumValue(this.#utxos);
    }

    /**
     * @type {number}
     */
    get state() {
        return this.#state;
    }

    /**
     * @param {Contract} other 
     * @returns {boolean}
     */
    eq(other) {
        return this.#datum.toSchemaJson() == other.#datum.toSchemaJson();
    }

    /**
     * @param {UTxO[]} utxos 
     * @returns {Contract[]}
     */
    static groupUtxos(utxos) {
        // group based on equal datum
        
        /** @type {Map<string, UTxO[]>} */
        const groups = new Map();

        for (const utxo of utxos) {
            const datum = utxo.origOutput.datum;

            if (datum !== null && datum instanceof InlineDatum) {                
                const key = bytesToHex(datum.data.toCbor());

                const lst = groups.get(key);

                if (lst === undefined) {
                    groups.set(key, [utxo]);
                } else {
                    lst.push(utxo);
                }
            }
        }

        return Array.from(groups.entries()).map(([key, utxos]) => {
            const datum = ConstrData.fromCbor(hexToBytes(key));

            return new Contract(datum, utxos);
        });
    }
}

/**
 * @param {Address} customerAddress 
 * @param {Address} vendorAddress
 * @param {Value} funds
 * @param {Value} price
 * @param {bigint} interval
 * @param {Date} nextWithdrawal 
 * @returns {UplcData}
 */
export function generateDatum(customerAddress, vendorAddress, funds, price, interval, nextWithdrawal) {
    const program = Program.new(src);

    const customerPkh = customerAddress.pubKeyHash;
    if (customerPkh === null) {
        throw new Error("unexpected null customerPkh");
    } else {
        program.changeParam("CUSTOMER_BYTES", JSON.stringify(customerPkh.bytes));
    }

    const vendorPkh = vendorAddress.pubKeyHash;
    if (vendorPkh === null) {
        throw new Error("unexpected null vendorPkh");
    } else {
        program.changeParam("VENDOR_BYTES", JSON.stringify(vendorPkh.bytes));
    }

    if (!funds.assets.isZero()) {
        throw new Error("'funds' doesn't yet support other assets");
    } else {
        program.changeParam("FUNDS_LOVELACE", funds.lovelace.toString());
    }

    if (!price.assets.isZero()) {
        throw new Error("price doesn't yet support other assets");
    } else {
        program.changeParam("PRICE_LOVELACE", price.lovelace.toString());
    }

    program.changeParam("INTERVAL_MS", interval.toString());

    program.changeParam("NEXT_WDRWL_MS", nextWithdrawal.getTime().toString());

    return program.evalParam("DATUM").data;
}
