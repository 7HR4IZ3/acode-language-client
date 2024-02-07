# Acode Language Servers

Acode plugin that adds support for language servers.


## Supported Features

- Auto Complettion
- Import Completion (Javascript/Typescript/Python)
- Code Formatting (Full / Selected Text)
- Go to definition, declaration, implementation, references
- Rename Symbol
- Code actions
- Error Diagnostics


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
- VUE (Uses vue-language-server)


## Installation



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

### Python support

Using python requires you have `pylsp` pavkage installed

If you don't, it can be installed using:

```bash
pip install python-lsp-server
```

Check out [Pylsp Github Repo](https://github.com/python-lsp/python-lsp-server) for more info.

### Typescript Support

Typescript, Javascript, Tsx, Jsx support is added using `ts-loader`, `typescript` and `typescript-language-server`


> They are installed automatically if you cloned this repo and ran `npm install`.

To install run:

```bash
npm install ts-loader typescript typescript-language-server
```


## Running locally


To setup and run this plugin locally:

- Clone this repo (`git clone https://github.com/7HR4IZ3/acode-language-servers`)
- Change directory (`cd acode-language-servers`)
- Run `npm install`
- Use a bundler on `src/main.js` e.g webpack (`webpack build`)
- Install dist.zip (generated by webpack)
- Start server (`node server/server.js`)


## Contributing


Users can also add other language servers and send a pull request so they are
added to the plugin.

For an example on how to do so, check out the `html`, `typescript` and `svelte`
serverMode examples in `server/server.js`.

You can also use the `python` mode as an example on how to setup a websocket
proxy if the target language server can only be started as a websocket server.

An example of a stdin and stdout language server would be added in future.
