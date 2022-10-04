# Cardano Subscription Manager

This is a Cardano DApp for creating and managing regular interval subscriptions, using the [Helios](https://github.com/Hyperion-BT/Helios) library for the Smart Contract and Tx logic, and [Preact/Htm](https://preactjs.com/guide/v10/getting-started#alternatives-to-jsx) library as a minimal UI framework.

This repository serves as a template for building Cardano DApps using only client-side JavaScript.

The Cardano Subscription Manager doesn't use any build-steps. The development files, including those of dependencies, are served directly to the client. This approach was chosen in order to maximize auditability (it should be as easy as possible to verify the correct implementation of a DApp), and minimize the number of pieces of software that must be blindly trusted (ideally only your browser, wallet, and the Cardano-network itself).

This DApp Currently only works with the Eternl wallet (Chrome) connected to the Cardano preview testnet. Please raise a github issue if you would like to see another wallet/network supported. This is not so difficult to do, but if nobody cares about this DApp then we're not going to put in the effort.

## Deno as JavaScript language server for development
We recommend using Deno as a language server as it supports reading type annotations from external modules.

### Installing Deno
Install Deno using the following command (assuming you use Linux):
```
curl -fsSL https://deno.land/x/install/install.sh | sh
```

This should download the `deno` binary to `$HOME/.deno/bin/deno`. Either add this directory to your path, or copy the binary to the system-wide bin directory:
```
sudo cp $HOME/.deno/bin/deno /usr/local/bin/deno
```

### Configuring VSCode to use Deno
Make sure the `.vscode/settings.json` file points to the correct `deno` binary. Eg:
```
{
    "deno.enable": true,
    "deno.path": "/usr/local/bin/deno"
}
```

### Caching external sources
External modules must be cached by Deno before you can benefit from their type annotations.

Cache external modules using the following command:
```
deno cache --reload index.js
```
