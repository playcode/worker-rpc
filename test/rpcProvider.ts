import assert from 'assert'
import 'jsdom-global/register'
import { MessageChannel } from 'worker_threads'

import RpcProvider from '../src/RpcProvider'


suite('RPC provider', function () {

  let local: RpcProvider,
      remote: RpcProvider,
      errorLocal: Error | undefined,
      errorRemote: Error | undefined

  setup(function () {
    local = new RpcProvider(
      ( message, transfer ) => remote.dispatch(message, new MessageEvent('test', { ports: transfer })),
      50,
    )

    local.error.addHandler(err => errorLocal = err)

    remote = new RpcProvider(
      ( message, transfer ) => local.dispatch(message, new MessageEvent('test', { ports: transfer })),
      50,
    )

    remote.error.addHandler(err => errorRemote = err)

    errorRemote = errorLocal = undefined
  })

  suite('signals', function () {

    test('Signals are propagated', function () {
      let x = -1

      remote.registerSignalHandler('action', ( value: number ) => x = value)

      local.signal('action', 5)

      assert(!errorLocal)
      assert(!errorRemote)
      assert.strictEqual(x, 5)
    })

    test('Unregistered signals raise an error', function () {
      local.signal('action', 10)

      assert(errorLocal)
      assert(errorRemote)
    })

    test('Multiple signals do not interfere', function () {
      let x = -1, y = -1

      remote.registerSignalHandler('setx', ( value: number ) => x = value)
      remote.registerSignalHandler('sety', ( value: number ) => y = value)

      local.signal('setx', 5)
      local.signal('sety', 6)

      assert(!errorLocal)
      assert(!errorRemote)
      assert.strictEqual(x, 5)
      assert.strictEqual(y, 6)
    })

    test('Multiple handlers can be bound to one signal', function () {
      let x = -1

      remote.registerSignalHandler('action', ( value: number ) => x = value)

      local.signal('action', 1)
      local.signal('action', 2)

      assert(!errorLocal)
      assert(!errorRemote)
      assert.strictEqual(x, 2)
    })

    test('Handlers can be deregistered', function () {
      let x = -1

      const handler = ( value: number ) => x = value

      remote.registerSignalHandler('action', handler)
      remote.deregisterSignalHandler('action', handler)

      local.signal('action', 5)

      assert(!errorLocal)
      assert(!errorRemote)
      assert.strictEqual(x, -1)
    })

    test('Transfer is honored', function () {
      let x = -1
      const { port1, port2 } = new MessageChannel()
      const transfer = [port1, port2]
      let receivedTransfer: readonly MessagePort[] = []

      remote.registerSignalHandler('action', ( value: number, { ports } ) => {
        x = value
        receivedTransfer = ports
      })

      local.signal('action', 2, transfer)

      assert(!errorLocal)
      assert(!errorRemote)
      assert.strictEqual(x, 2)
      assert.notStrictEqual(receivedTransfer, transfer)
    })

  })

  suite('RPC', function () {

    test('RPC handlers can return values', function () {
      remote.registerRpcHandler('action', () => 10)

      return local
        .rpc('action')
        .then(result => (
          assert.strictEqual(result, 10),
            assert(!errorLocal),
            assert(!errorRemote)
        ))
    })

    test('RPC handlers can return promises', function () {
      remote.registerRpcHandler('action', () => new Promise(r => setTimeout(() => r(10), 15)))

      return local
        .rpc('action')
        .then(result => (
          assert.strictEqual(result, 10),
            assert(!errorLocal),
            assert(!errorRemote)
        ))
    })

    test('Promise rejection is transferred', function () {
      remote.registerRpcHandler('action', () => new Promise(( resolve, reject ) => setTimeout(() => reject(10), 15)))

      return local
        .rpc('action')
        .then(
          () => Promise.reject('should have been rejected'),
          result => (
            assert.strictEqual(result, 10),
              assert(!errorLocal),
              assert(!errorRemote)
          ),
        )
    })

    test('Invalid RPC calls are rejected', function () {
      return local
        .rpc('action')
        .then(
          () => Promise.reject('should have been rejected'),
          () => undefined,
        )
    })

    test('Invalid RPC calls throw on both ends', function () {
      return local
        .rpc('action')
        .then(
          () => Promise.reject('should have been rejected'),
          () => undefined,
        )
        .then(() => (
          assert(errorLocal),
            assert(errorRemote)
        ))
    })

    test('RPC calls time out', function () {
      remote.registerRpcHandler('action', () => new Promise(r => setTimeout(() => r(10), 100)))

      return local
        .rpc('action')
        .then(
          () => Promise.reject('should have been rejected'),
          () => ( assert(errorLocal), new Promise(r => setTimeout(r, 100)) ),
        )
        .then(() => assert(errorRemote))
    })

    test('RPC calls time out option', function () {
      remote.registerRpcHandler('action', () => new Promise(r => setTimeout(() => r(10), 45)))

      return local
        .rpc('action', null, null, {timeout: 35})
        .then(
          () => Promise.reject('should have been rejected'),
          () => ( assert(errorLocal), new Promise(r => setTimeout(r, 45)) ),
        )
        .then(() => assert(errorRemote))
    })

    test('Multiple RPC handlers do not interfere', function () {
      remote.registerRpcHandler('a1', ( value: number ) => new Promise(r => setTimeout(() => r(value), 30)))
      remote.registerRpcHandler('a2', ( value: number ) => 2 * value)

      return Promise
        .all([
          local.rpc('a1', 10),
          local.rpc('a2', 20),
        ])
        .then(( [r1, r2] ) => (
          assert.strictEqual(r1, 10),
            assert.strictEqual(r2, 40),
            assert(!errorLocal),
            assert(!errorRemote)
        ))
    })

    test('RPC handler can be deregistered', function () {
      const handler = () => 10

      remote.registerRpcHandler('action', handler)
      remote.deregisterRpcHandler('action', handler)

      return local
        .rpc('action')
        .then(
          () => Promise.reject('should have been rejected'),
          () => (
            assert(errorLocal),
              assert(errorRemote)
          ),
        )
    })

    test('Transfer is honored', function () {
      const { port1, port2 } = new MessageChannel()
      const transfer = [port1, port2]
      let receivedTransfer: readonly MessagePort[] = []

      remote.registerRpcHandler('action', ( msg, { ports } ) => {
        receivedTransfer = ports
        return msg
      })

      return local
        .rpc('action', 10, transfer)
        .then(x => (
          assert.notStrictEqual(receivedTransfer, transfer),
            assert.strictEqual(x, 10),
            assert(!errorLocal),
            assert(!errorRemote)
        ))
    })

  })

})
