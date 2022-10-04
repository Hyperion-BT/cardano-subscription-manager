/** @typedef {import("./render.js").UI} UI */
import { html } from "./render.js";
/** @typedef {import("./helios.js").Address} Address */
/** @typedef {import("./helios.js").Value} Value */
import { AdaInput, AddressInput, IntervalInput, DateTimeInput } from "./inputs.js";

/**
 * 
 * @param {{
 * balance: Value, 
 * onSubmit: (vendor: Address, funds: Value, price: Value, interval: bigint, firstWithdrawal: Date) => void, 
 * onCancel: () => void
 * }} props 
 * @returns {UI}
 */
export function SubscriptionForm(props) {
    const vendorInput = new AddressInput("vendor");

    const fundsInput = new AdaInput("funds", props.balance);

    const priceInput = new AdaInput("price");

    const intervalInput = new IntervalInput("interval");

    const dateTimeInput = new DateTimeInput("first-withdrawal");    

    const isValid = vendorInput.isValid() && fundsInput.isValid() && priceInput.isValid() && intervalInput.isValid() && dateTimeInput.isValid();

    /**
     * @param {Event} e 
     */
    function submit(e) {
        e.target.disabled = true;
        props.onSubmit(vendorInput.getAddress(), fundsInput.getValue(), priceInput.getValue(), intervalInput.getInterval(), dateTimeInput.getDate());
        e.target.disabled = false;
    }

    return html`
        <div id="subscription-form-wrapper">
            <div id="subscription-form">
                <div class="form-title">
                    <h1>New subscription</h1>
                    <button class="close" onClick=${props.onCancel}><img src="./img/close.svg"/></button>
                </div>
                <div class="form-row">
                    <label for="vendor">Vendor address</label>
                    ${vendorInput.render()}
                </div>
                <div class="form-row">
                    <label for="funds">Funds</label>
                    ${fundsInput.render()}
                </div>
                <div class="form-row">
                    <label for="price">Price</label>
                    ${priceInput.render()}
                </div>
                <div class="form-row">
                    <label for="interval">Interval</label>
                    ${intervalInput.render()}
                </div>
                <div class="form-row">
                    <label for="first-withdrawal">First withdrawal</label>
                    ${dateTimeInput.render()}
                </div>
                <div class="form-final-row">
                    <button class="cancel" onClick=${props.onCancel}>Cancel</button>
                    <button class="submit" disabled=${!isValid} onClick=${submit}>Submit</button>
                </div>
            </div>
        </div>
    `;
}