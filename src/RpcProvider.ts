import { Event } from 'microevent.ts'

import RpcProviderInterface  from './RpcProviderInterface'


const MSG_RESOLVE_TRANSACTION = 'resolve_transaction',
      MSG_REJECT_TRANSACTION  = 'reject_transaction',
      MSG_ERROR               = 'error'

interface Transaction {
  id: number;
  timeoutHandle?: any;

  resolve( result: any ): void;

  reject( error: string ): void;
}

class RpcProvider implements RpcProviderInterface {

  constructor(
    private _dispatch: RpcProvider.Dispatcher,
    private _rpcTimeout = 0,
  ) {
  }

  dispatch( payload: any, event: MessageEvent ): void {
    const message = payload as RpcProvider.Message

    switch ( message.__type ) {
      case RpcProvider.MessageType.signal:
        return this._handleSignal(message, event)

      case RpcProvider.MessageType.rpc:
        return this._handeRpc(message, event)

      case RpcProvider.MessageType.internal:
        return this._handleInternal(message)

      default:
        this._raiseError(`invalid message type ${ message.__type }`)
    }
  }

  rpc<T = void, U = void>(
    id: string,
    payload?: T,
    transfer?: any,
    options: RpcProviderInterface.RpcCallOptions = {} ): Promise<U> {
    const transactionId = this._nextTransactionId++

    this._dispatch({
      __rpc: true,
      __type: RpcProvider.MessageType.rpc,
      __transactionId: transactionId,
      __id: id,
      __payload: payload,
    }, transfer ? transfer : undefined)

    return new Promise(
      ( resolve, reject ) => {
        const transaction = this._pendingTransactions[transactionId] = {
          id: transactionId,
          resolve,
          reject,
        }

        const timeout = options.timeout ||  this._rpcTimeout

        if ( timeout > 0 ) {
          this._pendingTransactions[transactionId].timeoutHandle =
            setTimeout(() => this._transactionTimeout(transaction), timeout)
        }
      },
    )
  };

  signal<T = void>( id: string, payload?: T, transfer?: any ): this {
    this._dispatch({
      __rpc: true,
      __type: RpcProvider.MessageType.signal,
      __id: id,
      __payload: payload,
    }, transfer ? transfer : undefined)

    return this
  }

  registerRpcHandler<T = void, U = void>( id: string, handler: RpcProviderInterface.RpcHandler<T, U> ): this {
    if ( this._rpcHandlers[id] ) {
      throw new Error(`rpc handler for ${ id } already registered`)
    }

    this._rpcHandlers[id] = handler

    return this
  };

  registerSignalHandler<T = void>( id: string, handler: RpcProviderInterface.SignalHandler<T> ): this {
    if ( !this._signalHandlers[id] ) {
      this._signalHandlers[id] = []
    }

    this._signalHandlers[id].push(handler)

    return this
  }

  deregisterRpcHandler<T = void, U = void>( id: string, handler: RpcProviderInterface.RpcHandler<T, U> ): this {
    if ( this._rpcHandlers[id] ) {
      delete this._rpcHandlers[id]
    }

    return this
  };

  deregisterSignalHandler<T = void>( id: string, handler: RpcProviderInterface.SignalHandler<T> ): this {
    if ( this._signalHandlers[id] ) {
      this._signalHandlers[id] = this._signalHandlers[id].filter(h => handler !== h)
    }

    return this
  }

  private _raiseError( error: string ): void {
    this.error.dispatch(new Error(error))

    this._dispatch({
      __rpc: true,
      __type: RpcProvider.MessageType.internal,
      __id: MSG_ERROR,
      __payload: error,
    })
  }

  private _handleSignal( message: RpcProvider.Message, event: MessageEvent ): void {
    if ( !this._signalHandlers[message.__id] ) {
      return this._raiseError(`invalid signal ${ message.__id }`)
    }

    this._signalHandlers[message.__id].forEach(handler => handler(message.__payload, event))
  }

  private _handeRpc( message: RpcProvider.Message, event: MessageEvent ): void {
    if ( !this._rpcHandlers[message.__id] ) {
      return this._raiseError(`invalid rpc ${ message.__id }`)
    }

    Promise.resolve(this._rpcHandlers[message.__id](message.__payload, event))
      .then(
        ( result: any ) => this._dispatch({
          __rpc: true,
          __type: RpcProvider.MessageType.internal,
          __id: MSG_RESOLVE_TRANSACTION,
          __transactionId: message.__transactionId,
          __payload: result,
        }),
        ( reason: string ) => this._dispatch({
          __rpc: true,
          __type: RpcProvider.MessageType.internal,
          __id: MSG_REJECT_TRANSACTION,
          __transactionId: message.__transactionId,
          __payload: reason,
        }),
      )
  }

  private _handleInternal( message: RpcProvider.Message ): void {
    const transaction = typeof ( message.__transactionId ) !== 'undefined' ? this._pendingTransactions[message.__transactionId] : undefined

    switch ( message.__id ) {
      case MSG_RESOLVE_TRANSACTION:
        if ( !transaction || typeof ( message.__transactionId ) === 'undefined' ) {
          return this._raiseError(`no pending transaction with id ${ message.__transactionId }`)
        }

        transaction.resolve(message.__payload)
        this._clearTransaction(this._pendingTransactions[message.__transactionId])

        break

      case MSG_REJECT_TRANSACTION:
        if ( !transaction || typeof ( message.__transactionId ) === 'undefined' ) {
          return this._raiseError(`no pending transaction with id ${ message.__transactionId }`)
        }

        this._pendingTransactions[message.__transactionId].reject(message.__payload)
        this._clearTransaction(this._pendingTransactions[message.__transactionId])

        break

      case MSG_ERROR:
        this.error.dispatch(new Error(`remote error: ${ message.__payload }`))
        break

      default:
        this._raiseError(`unhandled internal message ${ message.__id }`)
        break
    }
  }

  private _transactionTimeout( transaction: Transaction ): void {
    transaction.reject('transaction timed out')

    this._raiseError(`transaction ${ transaction.id } timed out`)

    delete this._pendingTransactions[transaction.id]

    return
  }

  private _clearTransaction( transaction: Transaction ): void {
    if ( typeof ( transaction.timeoutHandle ) !== 'undefined' ) {
      clearTimeout(transaction.timeoutHandle)
    }

    delete this._pendingTransactions[transaction.id]
  }

  error = new Event<Error>()

  private _rpcHandlers: { [id: string]: RpcProviderInterface.RpcHandler<any, any> } = {}
  private _signalHandlers: { [id: string]: Array<RpcProviderInterface.SignalHandler<any>> } = {}
  private _pendingTransactions: { [id: number]: Transaction } = {}

  private _nextTransactionId = 0
}

module RpcProvider {

  export enum MessageType {
    signal,
    rpc,
    internal
  }

  export interface Dispatcher {
    ( message: Message, transfer?: Array<any> ): void;
  }

  export interface Message {
    __rpc: true;
    __type: MessageType;
    __transactionId?: number;
    __id: string;
    __payload?: any;
  }

}

export default RpcProvider
