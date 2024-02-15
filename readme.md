# Acode Language Client
_____

> **Note** This plugin is meant to replace `Acode Language Servers` plugin. Uninstall before installing this plugin

Acode plugin that adds support for language servers.

_____
## Supported Features

- Auto Complettion
- Import Completion (Javascript/Typescript/Python)
- Code Formatting (Full / Selected Text)
- Go to definition, declaration, implementation, references
- Rename Symbol
- Code actions
- Error Diagnostics

_____
## Supported Languages


The following programming languages are currently supported.


> These are supported without starting the server.

- HTML
- CSS 
- SCSS 
- LESS
- JSON
- JSON5

> The following requires the server to work.

- JAVASCRIPT (Uses typescript)
- TYPESCRIPT (Uses typescript)
- JSX (Uses typescript)
- TSX (Uses typescript)
- PYTHON (Uses pylsp)
- JAVA (Uses jdtls)
- C-CPP (Uses clangd)
- RUST (Uses rust-analyzer)
- VUE (Uses vue-language-server)

_____
## Usage

This section explains how to use the plugin and the exposed api's for usage in other Acode plugins


Youtube tutorial: https://youtu.be/e8Ge4qBd--c?si=314bPpChORcFu4jT
<iframe src="https://youtu.be/e8Ge4qBd--c?si=314bPpChORcFu4jT"></iframe>


_____
### Server

The server is an express websocket application where:

`/python` sets up a jsonrpc websocket connection to the python language server.
`/javascript` sets up a jsonrpc websocket connection to the javascript language
server etc.

If you cloned this repo, it comes with the server so just run:

``` bash
cd acode-language-servers
npm install
node server/server.mjs
```


To install the server run the following command:

``` bash
git clone https://github.com/7HR4IZ3/acode-language-server.git
cd acode-language-server
npm install
node server.mjs
```
_____
### API

The plugin exposes the following api's to create language clients for Acode

Example of a acode typescript plugin that adds typescript language client abilities

```javascript
class TypescriptPlugin {
  init() {

    // Method to ensure Acode Language Client is setup before continuing
    let acodeLanguageClient = acode.require("acode-language-client");
    if (acodeLanguageClient) {
      this.setupLangaugeClient(acodeLanguageClient);
    } else {
      window.addEventListener("plugin.install", ({ detail }) => {
        if (detail.name === "acode-language-client") {
          acodeLanguageClient = acode.require("acode-language-client");
          this.setupLangaugeClient(acodeLanguageClient);
        }
      });
    }
  }

  setupLangaugeClient(acodeLanguageClient) {
    // Get Socket for typescript language server
    let socket = acodeLanguageClient.getSocket("server/typescript");

    // Create client for server
    let typescriptClient = new acodeLanguageClient.LanguageClient({
      type: "socket", socket
    });
    
    // Register client to the editor
    acodeLanguageClient.registerService(
      "typescript|javascript|tsx|jsx",
      typescriptClient
    );
  }
}

if (window.acode) {
  const typescript = new TypescriptPlugin();
  acode.setPluginInit(
    plugin.id,
    (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
      if (!baseUrl.endsWith("/")) baseUrl += "/";
      typescript.baseUrl = baseUrl;
      typescript.init($page, cacheFile, cacheFileUrl);
    }
  );
  acode.setPluginUnmount(plugin.id, () => {
    typescript.destroy();
  });
}
```

_____

#### `.getSocket(url: string)`

> The argument url must start with either `server/` or `auto/`. If not use `ReconnectingWebSocket` instead of `.getSocket`

This function returns a `ReconnectingWebsocket` instance.
Use `server/<language>` the language is in:

- typescript
- python
- java
- vue
- html
- c_cpp

Else use `auto/<command_to_run>?args=<command_args>` to execute an already
installed language server by command.

_____

#### `.registerService(mode: string, client: LanguageClient)`

Registers a `LanguageClient` instance to the editor.
The `mode` option refers to the language mode you want this client to be used for, you can seperate modes by using `|` e.g ("html|css|javascript")

_____

#### `.LanguageClient`

This returns `ace_linters.LanguageClient` class which represents a language
client connection

##### Properties

- `constructor(config: object)`: This accepts a config object with possible keys

  * `type: string` Can be one of (`socket`, `worker`)
  * `socket: WebSocket | ReconnectingWebsocket`: if `type` option equals
  `socket` then this is required.
  * `worker: Worker`: if `type` option equals `worker` then this is required.

- `.connection`: This represents the connection object typically returned by
`vscode-languageserver's` `createConnection` method. Refer to the package to
learn more.

_____
#### `.ReconnectingWebsocket`

This is a wrapper around WebSocket class but allows you to:
- Only create the connection when a message is sent to the server.
- Reconnect to the server when connection is abruptly closed.

##### Properties

- `constructor(url: string, protocol: string, autoConnect: boolean, autoReconnect: boolean)`: The `url` and `protocol` option are passed to the `WebSocket` class, `autoConnect` refers to whether to connect to the server on creation or wait till a message is sent, `defaults` to `false`.
- `.connect()`: Connect to the server
- `.close()`: Close connection to the server and don't try to reconnect.
- `.reconnect()`: Close connection if connected then connect to server.


_____
## Running locally


To setup and run this plugin locally:

- Clone this repo (`git clone https://github.com/7HR4IZ3/acode-language-servers`)
- Change directory (`cd acode-language-servers`)
- Run `npm install`
- Use a bundler on `src/main.js` e.g webpack (`webpack build`)
- Install dist.zip (generated by webpack)
- Start server (`node server/server.js`)

_____
## Contributing


Users can also add other language servers and send a pull request so they are
added to the plugin.

For an example on how to do so, check out the `html`, `typescript` and `svelte`
serverMode examples in `server/server.js`.

You can also use the `python` mode as an example on how to setup a websocket
proxy if the target language server can only be started as a websocket server.

An example of a stdin and stdout language server would be added in future.
