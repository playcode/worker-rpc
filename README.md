**This is a fork of npm package `worker-rpc`**. 
 - Ports transferring.
 - Unique message interface.
 - We use it havily in [PlayCode JavaScript Compiler](https://playcode.io/javascript-compiler)

# What is it?

This package provides a simple RPC mechanism on top of any transport that transfers
JSON data. It was initially conceived to provide communication with web workers
(and as such supports transferables), but it can be used on top of many other
different transport channels, i.e. `postMessage` between frames, websockets via
`socket.io` or JSON encoded messages over pipes.

# How to use it?

## Installation

You can install the library into your project via npm

```bash
npm install worker-rpc
```

The library is written in Typescript and will work in any environment that
supports ES5 and ES6-style promises (either native or through a shim).
No external typings are required for using this library with Typescript (version >= 2).

## Web worker example

In this example, we use the library to set up communication with a web worker.

### Web worker

```js
import {RpcProvider} from 'worker-rpc';

const rpcProvider = new RpcProvider(
    (message, transfer) => postMessage(message, transfer)
);

onmessage = e => rpcProvider.dispatch(e.data);

rpcProvider.registerRpcHandler('add', ({x, y}) => x + y);
```

The RPC provider is initialized with a function that dispatches a message.
This function will receive an opaque message object as first argument, and
a list of transferables as second argument. This allows to leverage transfer
of ownership instead of copying between worker and host page.

On incoming messages, `dispatch` is called on the RPC provider in order to
handle the message.

Each registered RPC handler is identified by a message ID (`add` in this example)
and has a handler function that receives the message object and can return a
result either as an immediate value or as a promise. 

### Page

```js
import {RpcProvider} from 'worker-rpc';

const worker = new Worker('worker.js'),
    rpcProvider = new RpcProvider(
        (message, transfer) => worker.postMessage(message, transfer)
    );

worker.onmessage = e => rpcProvider.dispatch(e.data);

rpcProvider
    .rpc('add', {x: 1, y: 2})
    .then(result => console.log(result)); // 3
```

## Importing

ES5 / CommonJS

```js
var RpcProvider = require('worker-rpc').RpcProvider;
```

ES6

```js
import {RpcProvider} from 'worker-rpc';
```

Typescript

```ts
import {RpcProvider, RpcProviderInterface} from 'worker-rpc';
```

##  API

The API is built around the `RpcProvider` class. A `RpcProvider` acts both as
client and server for RPC calls and event-like signals. The library uses ES6
promises and can consume any A+ compliant promises.

### Creating a new provider

```js
const rpc = new RpcProvider(dispatcher, timeout);
```

 * `dispatcher`: A function that will be called for dispatching messages. The
    first argument will be an opaque message object, and the second argument
    an error of `Transferable` objects that are to be passed via ownership
    transfer (if supported by the transport).
 * `timeout` (optional): The timeout for RPC transactions in milliseconds.
    Values of `0` or smaller disable the timeout (this is the default).

### Incoming messages

```js
rpc.dispatch(message);
```

Similar to message dispatch, `worker-rpc` does not provide a built-in mechanism
for receiving messages. Instead, incoming messages must be relayed to the provider
by invoking `dispatch`.

 * `message`: The received message.

### Registering RPC handlers

```js
rpc.registerRpcHandler(id, handler);
```

Register a handler function for RPC calls with id `id`. Returns the provider instance.

 * `id`: RPC call id. Only a single handler can be registered for any id. Ids should
    be strings.
 * `handler`: The handler function. This function receives the payload object as
    its argument and can return its result either as an immediate value or as a 
    promise.

### Registering signal handlers

```js
rpc.registerSignalHandler(id, handler);
```

Register a handler function for signals with id `id`. Returns the provider instance.

 * `id`: Signal id. The namespace for signal ids is seperate from that of RPC ids,
    and multiple handlers my be attached tp a single signal. Ids should be strings
 * `handler`: The handler function. This function receives the payload object as
    its argument; the result is ignored.

### Dispatching RPC calls

```js
const result = rpc.rpc(id, payload, transfer, {timeout});
```

Dispatch a RPC call and returns a promise for its result. The promise is rejected
if the call times out or if no handler is registered (or if the handler rejects
the operation).

 * `id`: RPC call id.
 * `payload` (optional): RPC call payload.
 * `transfer` (optional): List of `Transferables` that will be passed to dispatched
   (see above).
 * `options` (optional): RPC call options.
   * `options.timeout` (optional): Custom timeout to this RPC call.

### Dispatching signals

```js
rpc.signal(id, payload, transfer);
```

Dispatch a signal. Returns the provider instance.

 * `id`: Signal id.
 * `payload` (optional): Signal payload.
 * `transfer` (optional): List of `Transferables` that will be passed to dispatched
   (see above).

### Deregistering RPC handlers

```js
rpc.deregisterRpcHandler(id, handler);
```

`id` and `handler` must be the same arguments used for `registerRpcHandler`.
Returns the provider instance.

### Deregistering signal handlers

```js
rpc.deregisterSignalHandler(id, handler);
```

`id` and `handler` must be the same arguments used for `registerSignalHandler`.
Returns the provider instance.

### Errors

```js
rpc.error.addHandler(errorHandler);
```

The error event is dispatched if there is either a local or remote communcation
error (timeout, invalid id, etc.). Checkout the
[microevent.ts](https://github.com/DirtyHairy/microevent)
documentation for the event API.

# License

Feel free to use this library under the conditions of the MIT license.
