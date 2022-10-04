/** @typedef {import("./render.js").UI} UI */
import { html, SPACE } from "./render.js";
/** @typedef {import("./helios.js").PubKeyHash} PubKeyHash */
import { Value, bytesToHex, Address } from "./helios.js";
import { ADA } from "./inputs.js";
import { Link } from "./Link.js";

/** @typedef {import("./contract.js").Contract} Contract */
/** @typedef {import("./wallet.js").WalletState} WalletState */

/**
 * @param {{
 * walletState: WalletState, 
 * pending: Contract[], 
 * contracts: Contract[], 
 * isSyncing: boolean, 
 * onSync: () => void, 
 * onCancel: (c: Contract) => Promise<void>,
 * onWithdraw: (c: Contract) => Promise<void>,
 * waitMessage: string,
 * }} props 
 */
export function Overview(props) {
    /**
     * @param {Value} value 
     * @returns {UI[]}
     */
    function renderAssets(value) {
        /** @type {UI[]} */
        const elems = [];

        if (value.lovelace > 0n) {
            elems.push(html`<p>${Number(value.lovelace)/1000000} ${ADA}</p>`)
        }

        for (const mph of value.assets.mintingPolicies) {
            const tokenNames = value.assets.getTokenNames(mph);

            for (const tokenName of tokenNames) {
                const bech32 = mph.toBech32();

                const fullName = bech32 + "." + bytesToHex(tokenName);

                elems.push(html`
                    <p>
                        <span>${value.assets.get(mph, tokenName).toString()}</span>${SPACE}<pre title="${fullName}">
                            <${Link} href="https://preview.cexplorer.io/asset/${bech32}" text="${bech32}"/>.${bytesToHex(tokenName)}
                        </pre>
                    </p>
                `);
            }
        }

        return elems;
    }

    /**
     * @param {PubKeyHash} pkh 
     * @returns {UI}
     */
    function renderPubKeyHash(pkh) {
        const addr = Address.fromPubKeyHash(true, pkh).toBech32();

        //return html`<pre title=${addr}><${Link} href="https://preview.cexplorer.io/address/${addr}" text=${addr}/></pre>`;
        return html`<pre title=${addr}>${addr}</pre>`; // link doesn't make much sense here because these address won't have been used yet
    }
    
    /**
     * @param {Contract} contract
     * @returns {UI[]}
     */
    function renderContract(contract) {
        /** @type {UI[]} */
        const fields = [];

        const isCustomer = props.walletState.isOwnPubKeyHash(contract.customer);
        const isVendor   = props.walletState.isOwnPubKeyHash(contract.vendor);
        
        /** @type {UI[]} */
        const actions = [];

        if (isCustomer) {
            actions.push(html`<button class="cancel" disabled=${contract.state != 1} onClick=${(/** @type {Event} */ _e) => {if (props.waitMessage == "") {props.onCancel(contract)}}}>Cancel</button>`);
        }
        
        if (isVendor) {
            actions.push(html`<button class="withdraw" disabled=${contract.state != 1 || !contract.canWithdraw()} onClick=${(/** @type {Event} */ _e) => {if (props.waitMessage == "") {props.onWithdraw(contract)}}}>Withdraw</button>`);
        }

        fields.push(html`<td>${actions}</td>`);

        fields.push(html`<td>${renderAssets(contract.funds)}</td>`);
        fields.push(html`<td>${renderAssets(contract.price)}</td>`);

        fields.push(html`<td>${(Number(contract.interval)/(1000*3600*24)).toFixed(2)} days</td>`); // TODO: better function for rendering duration
        fields.push(html`<td>${contract.nextWithdrawal.toLocaleString("se")}</td>`);

        fields.push(html`<td>${renderPubKeyHash(contract.customer)}</td>`);
        fields.push(html`<td>${renderPubKeyHash(contract.vendor)}</td>`);
        
        return fields;
    }

    const cs = (
        props.contracts === null ? 
            [] :
            props.contracts.filter(c => {
                return props.walletState.isOwnPubKeyHash(c.customer) || props.walletState.isOwnPubKeyHash(c.vendor)
            })
    ).filter(c => props.pending.findIndex(pc => pc.eq(c)) == -1); // only contracts that aren't pending

    return html`
        <div id="overview-wrapper">
            <div id="overview">
                <div class="form-title">
                    <h1>Active Subscriptions</h1>
                    <button disabled=${props.isSyncing || props.pending.length > 0} onClick=${() => {props.onSync()}}><img src="./img/refresh.svg"/></button>
                </div>
                <div id="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Funds</th>
                                <th>Price</th>
                                <th>Interval</th>
                                <th>Next Withdrawal</th>
                                <th>Customer</th>
                                <th>Vendor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${props.pending.map(c => html`<tr class="state-${c.state}">${renderContract(c)}</tr>`)}
                            ${cs.map(c => {
                                if (props.pending.findIndex(pc => pc.eq(c)) == -1) {
                                    return html`<tr>${renderContract(c)}</tr>`;
                                } else {
                                    return null;
                                }
                            })}
                            <tr class="empty"><td colspan="7">${(cs.length == 0 && props.pending.length == 0) ? html`<i>No active subscriptions</i>` : null}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}
